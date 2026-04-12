pipeline {
    agent any

    // ── MENÚ DE SELECCIÓN PARA BLUE/GREEN ──
    parameters {
        choice(
            name: 'DESPLIEGUE_PROD', 
            choices: ['ninguno', 'blue', 'green'], 
            description: 'Selecciona qué entorno de producción quieres activar/actualizar'
        )
    }

    environment {
        APP_NAME  = "restaurante-app"
        IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Clonando rama: ${GIT_BRANCH}"
                checkout scm
                sh 'git log -1 --pretty=format:"Hash: %H - Autor: %an"'
            }
        }

        stage('Build & Test') {
            steps {
                echo "Construyendo y testeando imagen Docker..."
                sh "docker build -t ${APP_NAME}:${IMAGE_TAG} -t ${APP_NAME}:latest -f app/Dockerfile ./app"
            }
        }

        stage('Deploy Staging') {
            steps {
                echo "Desplegando en Staging..."
                // Limpiamos la sintaxis para evitar errores previos
                sh "docker compose up -d --force-recreate app-staging"
                sleep 5
                sh "docker ps | grep staging"
            }
        }

        stage('Smoke Test') {
            steps {
                echo "Verificando que staging responde..."
                sh """
                    for i in 1 2 3 4 5; do
                        STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://app-staging:3000/health || echo "000")
                        echo "Intento \$i: HTTP \$STATUS"
                        if [ "\$STATUS" = "200" ]; then
                            echo "Smoke test OK"
                            exit 0
                        fi
                        sleep 3
                    done
                    echo "Smoke test fallido"
                    exit 1
                """
            }
        }

        // ── NUEVA ETAPA PARA BLUE/GREEN ──
        stage('Deploy Production (Manual)') {
            when {
                expression { params.DESPLIEGUE_PROD != 'ninguno' }
            }
            steps {
                script {
                    if (params.DESPLIEGUE_PROD == 'blue') {
                        echo "Desplegando en entorno BLUE (Puerto 3000)..."
                        sh "docker compose up -d --force-recreate app-prod-blue"
                        // Opcional: apagar el otro para completar el switch
                        // sh "docker compose --profile green-deploy stop app-prod-green || true"
                    } else if (params.DESPLIEGUE_PROD == 'green') {
                        echo "Desplegando en entorno GREEN (Puerto 3002)..."
                        sh "docker compose --profile green-deploy up -d --force-recreate app-prod-green"
                        // sh "docker compose stop app-prod-blue || true"
                    }
                }
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline completado - Build ${BUILD_NUMBER}"
        }
        failure {
            echo "❌ Pipeline fallido - revisar logs"
        }
        always {
            echo "🧹 Limpiando imagenes temporales..."
            sh 'docker image prune -f || true'
        }
    }
}