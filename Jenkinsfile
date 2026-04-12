pipeline {

    agent any

    environment {
        APP_NAME  = "restaurante-app"
        IMAGE_TAG = "build-${BUILD_NUMBER}"
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
                sh """
                    docker build \
                        -t restaurante-app:${IMAGE_TAG} \
                        -t restaurante-app:latest \
                        -f app/Dockerfile \
                        ./app
                """
            }
        }

        stage('Deploy Staging') {
            steps {
                echo "Desplegando en Staging..."
                sh '''
                    # Verificar versiones disponibles
                    docker --version
                    which docker
                    
                    # Usar path completo del plugin compose
                    /usr/local/lib/docker/cli-plugins/docker-compose up \
                        --detach \
                        --force-recreate \
                        app-staging || \
                    docker compose up \
                        --detach \
                        --force-recreate \
                        app-staging
                    
                    sleep 5
                    docker ps | grep staging
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                echo "Verificando que staging responde..."
                sh """
                    for i in 1 2 3 4 5; do
                        STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://app-staging:3000/health)
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