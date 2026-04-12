pipeline {
    agent any

    environment {
        APP_NAME = "restaurante-app"
        // Aseguramos que el tag coincida en todas las etapas
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
                // Si RUN npm run test:ci falla en el Dockerfile, esta etapa fallará
                sh """
                    docker build \
                        -t ${APP_NAME}:${IMAGE_TAG} \
                        -t ${APP_NAME}:latest \
                        -f app/Dockerfile \
                        ./app
                """
            }
        }

        stage('Deploy Staging') {
            steps {
                echo "Desplegando en Staging..."
                sh '''
                    docker compose up -d app-staging --force-recreate
                    sleep 5
                    docker compose ps app-staging
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                echo "Verificando que staging responde..."
                sh '''
                    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
                    echo "HTTP Status: $STATUS"
                    if [ "$STATUS" != "200" ]; then
                        echo "Smoke test fallido"
                        exit 1
                    fi
                    echo "Smoke test OK"
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline completado exitosamente - Build ${BUILD_NUMBER}"
        }
        failure {
            echo "❌ Pipeline fallido - revisar logs del Build ${BUILD_NUMBER}"
        }
        always {
            echo "🧹 Limpiando imágenes temporales..."
            sh 'docker image prune -f || true'
        }
    }
}