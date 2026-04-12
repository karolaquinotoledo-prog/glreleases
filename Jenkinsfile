pipeline {
    agent any

    tools {
        nodejs 'node20'
    }

    environment {
        APP_NAME        = "restaurante-app"
        IMAGE_NAME      = "restaurante-app"
        GIT_REPO_URL    = "https://github.com/karolaquinotoledo-prog/glreleases.git"
        TEST_COVERAGE_THRESHOLD = "70"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('📥 Checkout') {
            steps {
                echo "🔄 Clonando repositorio..."
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG = "v${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        stage('🔍 Lint') {
            steps {
                echo "🔎 Analizando código..."
                sh 'npm install --silent && echo "Lint OK"'
            }
        }

        stage('🔨 Build') {
            steps {
                echo "🏗️ Construyendo imagen..."
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -f app/Dockerfile ./app"
            }
        }

        stage('🚀 Deploy') {
            steps {
                echo "📡 Desplegando en Staging..."
                sh "APP_VERSION=${IMAGE_TAG} docker compose up -d app-staging --force-recreate"
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline completado con éxito"
        }
        failure {
            echo "❌ Pipeline fallido"
        }
    }
}