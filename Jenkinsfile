pipeline {
    agent any

    tools {
        nodejs 'node20'
    }

    environment {
        APP_NAME = "restaurante-app"
        IMAGE_NAME = "restaurante-app"
    }

    stages {
        stage('📥 Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG = "v${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        stage('🔨 Build') {
            steps {
                echo "Construyendo imagen..."
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -f app/Dockerfile ./app"
            }
        }

        stage('🚀 Deploy') {
            steps {
                echo "Desplegando..."
                sh "APP_VERSION=${IMAGE_TAG} docker compose up -d app-staging --force-recreate"
            }
        }
    }

    post {
        always {
            echo "Pipeline finalizado"
        }
    }
}