/*
 ╔══════════════════════════════════════════════════════════════╗
 ║  Jenkinsfile – Pipeline CI/CD Declarativo                   ║
 ║  Proyecto: RestauranteApp                                   ║
 ║  Etapas: Checkout → Build → Test → Scan → Publish → Notify  ║
 ╚══════════════════════════════════════════════════════════════╝
*/

pipeline {

    // Ejecutar en cualquier agente disponible (o especificar uno)
    agent any

    // ── Variables de entorno globales ────────────────────────────────
    environment {
        APP_NAME        = "restaurante-app"
        DOCKER_REGISTRY = "localhost:5000"            // Registry local
        IMAGE_NAME      = "${DOCKER_REGISTRY}/${APP_NAME}"
        IMAGE_TAG       = "${GIT_BRANCH.replaceAll('/', '-')}-${BUILD_NUMBER}"
        GIT_REPO_URL    = "https://github.com/karolaquinotoledo-prog/glreleases.git"

        // Credenciales configuradas en Jenkins Credentials Manager
        DOCKER_CREDS    = credentials('docker-registry-creds')
        SONAR_TOKEN     = credentials('sonarqube-token')

        // Umbrales de calidad
        TEST_COVERAGE_THRESHOLD = "70"
    }

    // ── Opciones del pipeline ────────────────────────────────────────
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
       
    }

    // ── Triggers ─────────────────────────────────────────────────────
    triggers {
        // Polling del repositorio cada 5 minutos
        pollSCM('H/5 * * * *')
        // O usar webhook de GitHub: githubPush()
    }

    // ══════════════════════════════════════════════════════════════════
    // STAGES
    // ══════════════════════════════════════════════════════════════════
    stages {

        // ── Stage 1: Checkout ────────────────────────────────────────
        stage('📥 Checkout') {
            steps {
                echo "🔄 Clonando repositorio rama: ${GIT_BRANCH}"
                checkout scm
                sh '''
                    echo "━━━━ Información del commit ━━━━"
                    git log -1 --pretty=format:"Hash: %H%nAutor: %an%nFecha: %ad%nMensaje: %s"
                    echo ""
                '''
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.IMAGE_TAG = "${env.GIT_BRANCH.replaceAll('/', '-')}-${env.GIT_COMMIT_SHORT}-${env.BUILD_NUMBER}"
                    echo "🏷️  Imagen tag: ${env.IMAGE_TAG}"
                }
            }
        }

        // ── Stage 2: Lint & Static Analysis ─────────────────────────
        stage('🔍 Lint & Static Analysis') {
            steps {
                echo "🔎 Analizando calidad de código..."
                sh '''
                    npm install --silent
                    npx eslint . --ext .js --format stylish --max-warnings 10 || true
                '''
            }
        }

        // ── Stage 3: Build ───────────────────────────────────────────
        stage('🔨 Build') {
            steps {
                echo "🏗️  Construyendo imagen Docker..."
                sh '''
                    docker build \
                        --target runner \
                        --build-arg APP_VERSION=${IMAGE_TAG} \
                        --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                        --build-arg GIT_COMMIT=${GIT_COMMIT_SHORT} \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} \
                        -t ${IMAGE_NAME}:latest \
                        -f app/Dockerfile \
                        ./app

                    echo "✅ Imagen construida: ${IMAGE_NAME}:${IMAGE_TAG}"
                    docker images | grep ${APP_NAME}
                '''
            }
        }

        // ── Stage 4: Test ────────────────────────────────────────────
        stage('🧪 Test') {
            parallel {
                // Tests unitarios e integración
                stage('Unit & Integration Tests') {
                    steps {
                        echo "🧬 Ejecutando suite de tests..."
                        dir('app') {
                            sh '''
                                npm ci --silent
                                npm run test:ci 2>&1
                            '''
                        }
                    }
                    post {
                        always {
                            // Publicar resultados JUnit en Jenkins
                            junit allowEmptyResults: true,
                                  testResults: 'app/junit.xml'

                            // Publicar reporte de cobertura
                            publishHTML([
                                allowMissing: false,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'app/coverage/lcov-report',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report',
                                reportTitles: 'Code Coverage'
                            ])
                        }
                    }
                }

                // Scan de vulnerabilidades de imagen Docker
                stage('Security Scan') {
                    steps {
                        echo "🔒 Escaneando vulnerabilidades con Trivy..."
                        sh '''
                            # Instalar Trivy si no está presente
                            if ! command -v trivy &> /dev/null; then
                                wget -qO- https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
                            fi

                            trivy image \
                                --exit-code 0 \
                                --severity HIGH,CRITICAL \
                                --format table \
                                ${IMAGE_NAME}:${IMAGE_TAG} || echo "⚠️  Vulnerabilidades encontradas - revisar reporte"

                            # Generar reporte JSON
                            trivy image \
                                --format json \
                                --output trivy-report.json \
                                ${IMAGE_NAME}:${IMAGE_TAG} || true
                        '''
                    }
                }
            }
        }

        // ── Stage 5: Quality Gate ────────────────────────────────────
        stage('🚦 Quality Gate') {
            steps {
                echo "📊 Verificando umbrales de calidad..."
                script {
                    // Leer cobertura del reporte de Jest
                    def coverageFile = 'app/coverage/coverage-summary.json'
                    if (fileExists(coverageFile)) {
                        def coverage = readJSON file: coverageFile
                        def lineCoverage = coverage.total.lines.pct
                        echo "📈 Cobertura de líneas: ${lineCoverage}%"
                        if (lineCoverage < env.TEST_COVERAGE_THRESHOLD.toInteger()) {
                            error("❌ Cobertura ${lineCoverage}% es menor al umbral requerido de ${env.TEST_COVERAGE_THRESHOLD}%")
                        }
                        echo "✅ Quality Gate pasado: ${lineCoverage}% >= ${env.TEST_COVERAGE_THRESHOLD}%"
                    } else {
                        echo "⚠️  Archivo de cobertura no encontrado, saltando quality gate"
                    }
                }
            }
        }

        // ── Stage 6: Publicar Artefacto ──────────────────────────────
        stage('📦 Publicar Artefacto') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                    branch 'release/*'
                }
            }
            steps {
                echo "📤 Publicando imagen al Registry..."
                sh '''
                    echo ${DOCKER_CREDS_PSW} | docker login ${DOCKER_REGISTRY} \
                        -u ${DOCKER_CREDS_USR} --password-stdin

                    docker push ${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${IMAGE_NAME}:latest

                    echo "✅ Imagen publicada: ${IMAGE_NAME}:${IMAGE_TAG}"

                    # Guardar el tag para el CD (Argo CD / GitOps)
                    echo "${IMAGE_TAG}" > artifact.txt
                    cat artifact.txt
                '''
            }
        }

        // ── Stage 7: Update GitOps Manifests ────────────────────────
        stage('🔄 Update GitOps Repo') {
            when {
                branch 'main'
            }
            steps {
                echo "📝 Actualizando manifiestos en repo GitOps..."
                sh '''
                    # Actualizar el tag de imagen en el manifiesto de K8s
                    sed -i "s|image: restaurante-app:.*|image: ${IMAGE_NAME}:${IMAGE_TAG}|g" \
                        k8s/deployment.yml

                    git config user.email "jenkins@devops.local"
                    git config user.name "Jenkins CI"
                    git add k8s/deployment.yml
                    git commit -m "ci: actualizar imagen a ${IMAGE_TAG} [skip ci]"
                    git push origin main
                '''
                echo "✅ Argo CD detectará el cambio y desplegará automáticamente"
            }
        }

        // ── Stage 8: Deploy a Staging ────────────────────────────────
        stage('🚀 Deploy Staging') {
            when {
                branch 'develop'
            }
            steps {
                echo "📡 Desplegando en Staging..."
                sh '''
                    APP_VERSION=${IMAGE_TAG} docker compose up -d app-staging --force-recreate

                    # Esperar a que esté healthy
                    echo "⏳ Esperando que el servicio esté listo..."
                    sleep 10
                    docker compose ps app-staging
                '''
            }
        }

        // ── Stage 9: Smoke Test Post-Deploy ─────────────────────────
        stage('💨 Smoke Tests') {
            when {
                branch 'develop'
            }
            steps {
                echo "🌡️  Ejecutando smoke tests en Staging..."
                sh '''
                    # Verificar que el health check responde
                    for i in $(seq 1 5); do
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
                        if [ "$STATUS" = "200" ]; then
                            echo "✅ Health check OK: HTTP $STATUS"
                            break
                        fi
                        echo "Intento $i: HTTP $STATUS - reintentando en 5s..."
                        sleep 5
                    done

                    if [ "$STATUS" != "200" ]; then
                        echo "❌ Smoke test fallido"
                        exit 1
                    fi
                '''
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // POST-PIPELINE: Notificaciones y limpieza
    // ══════════════════════════════════════════════════════════════════
    post {
        success {
            echo "✅ Pipeline completado exitosamente"
            script {
                // Notificación Slack (requiere plugin de Slack)
                slackSend(
                    channel: '#devops-alerts',
                    color: 'good',
                    message: """
                        ✅ *BUILD EXITOSO* - ${env.APP_NAME}
                        Branch: `${env.GIT_BRANCH}`
                        Build: #${env.BUILD_NUMBER}
                        Imagen: `${env.IMAGE_NAME}:${env.IMAGE_TAG}`
                        Duración: ${currentBuild.durationString}
                    """.stripIndent()
                )
            }
        }

        failure {
            echo "❌ Pipeline fallido"
            script {
                slackSend(
                    channel: '#devops-alerts',
                    color: 'danger',
                    message: """
                        ❌ *BUILD FALLIDO* - ${env.APP_NAME}
                        Branch: `${env.GIT_BRANCH}`
                        Build: #${env.BUILD_NUMBER}
                        Ver logs: ${env.BUILD_URL}
                    """.stripIndent()
                )
            }
        }

        always {
            echo "🧹 Limpiando artefactos temporales..."
            sh '''
                docker system prune -f --filter "label=app=restaurante" || true
                docker rmi ${IMAGE_NAME}:${IMAGE_TAG} 2>/dev/null || true
            '''
            cleanWs()
        }
    }
}
