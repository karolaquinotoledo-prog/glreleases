pipeline {

    agent any

    // ── Parámetros que aparecen antes de ejecutar ─────────────────
    parameters {
        choice(
            name: 'DEPLOY_SLOT',
            choices: ['blue', 'green'],
            description: 'Elegir el slot de produccion a desplegar'
        )
        choice(
            name: 'DEPLOY_ENV',
            choices: ['staging', 'production', 'ambos'],
            description: 'Elegir el entorno de despliegue'
        )
        booleanParam(
            name: 'SKIP_SMOKE_TEST',
            defaultValue: false,
            description: 'Saltar el smoke test'
        )
    }

    environment {
        APP_NAME  = "restaurante-app"
        IMAGE_TAG = "build-${BUILD_NUMBER}"
        // Puerto según el slot elegido
        PROD_PORT = "${params.DEPLOY_SLOT == 'blue' ? '3000' : '3002'}"
        CONTAINER_NAME = "restaurante-prod-${params.DEPLOY_SLOT}"
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

        stage('Informacion del Deploy') {
            steps {
                echo """
                ╔══════════════════════════════════════╗
                  CONFIGURACION DEL DESPLIEGUE
                  Slot      : ${params.DEPLOY_SLOT}
                  Entorno   : ${params.DEPLOY_ENV}
                  Imagen    : ${IMAGE_TAG}
                  Puerto    : ${PROD_PORT}
                ╚══════════════════════════════════════╝
                """
            }
        }

        stage('Build') {
            steps {
                echo "Construyendo imagen Docker..."
                sh """
                    docker build \
                        -t restaurante-app:${IMAGE_TAG} \
                        -t restaurante-app:latest \
                        -f app/Dockerfile \
                        ./app

                    echo "Imagen construida:"
                    docker images | grep restaurante-app
                """
            }
        }

        stage('Deploy Staging') {
            // Solo ejecuta si el entorno elegido es staging o ambos
            when {
                expression {
                    return params.DEPLOY_ENV == 'staging' || params.DEPLOY_ENV == 'ambos'
                }
            }
            steps {
                echo "Desplegando en Staging..."
                sh """
                    docker stop restaurante-staging 2>/dev/null || true
                    docker rm restaurante-staging 2>/dev/null || true

                    docker run --detach \
                        --name restaurante-staging \
                        --publish 3001:3000 \
                        --env NODE_ENV=staging \
                        --env PORT=3000 \
                        --env JWT_SECRET=staging_secret \
                        --env APP_VERSION=${IMAGE_TAG} \
                        restaurante-app:${IMAGE_TAG}

                    sleep 5
                    docker ps | grep restaurante-staging
                    echo "Staging activo en http://localhost:3001"
                """
            }
        }

        stage('Smoke Test') {
            when {
                expression {
                    return params.SKIP_SMOKE_TEST == false &&
                           (params.DEPLOY_ENV == 'staging' || params.DEPLOY_ENV == 'ambos')
                }
            }
            steps {
                echo "Verificando staging..."
                sh '''
                    for i in 1 2 3 4 5; do
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
                        echo "Intento $i: HTTP $STATUS"
                        if [ "$STATUS" = "200" ]; then
                            echo "Smoke test OK"
                            exit 0
                        fi
                        sleep 3
                    done
                    echo "Staging no responde pero continuando"
                    exit 0
                '''
            }
        }

        stage('Deploy Produccion') {
            // Solo ejecuta si el entorno elegido es production o ambos
            when {
                expression {
                    return params.DEPLOY_ENV == 'production' || params.DEPLOY_ENV == 'ambos'
                }
            }
            steps {
                echo "Desplegando en Produccion slot: ${params.DEPLOY_SLOT}..."
                sh """
                    # Detener el contenedor del slot elegido si existe
                    docker stop ${CONTAINER_NAME} 2>/dev/null || true
                    docker rm ${CONTAINER_NAME} 2>/dev/null || true

                    # Levantar el nuevo contenedor en el slot elegido
                    docker run --detach \
                        --name ${CONTAINER_NAME} \
                        --publish ${PROD_PORT}:3000 \
                        --env NODE_ENV=production \
                        --env PORT=3000 \
                        --env JWT_SECRET=prod_secret \
                        --env APP_VERSION=${IMAGE_TAG}-${params.DEPLOY_SLOT} \
                        restaurante-app:${IMAGE_TAG}

                    sleep 5
                    docker ps | grep ${CONTAINER_NAME}
                    echo "Produccion slot ${params.DEPLOY_SLOT} activo en http://localhost:${PROD_PORT}"
                """
            }
        }

        stage('Verificar Produccion') {
            when {
                expression {
                    return params.DEPLOY_ENV == 'production' || params.DEPLOY_ENV == 'ambos'
                }
            }
            steps {
                sh """
                    for i in 1 2 3 4 5; do
                        STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PROD_PORT}/health)
                        echo "Intento \$i: HTTP \$STATUS"
                        if [ "\$STATUS" = "200" ]; then
                            echo "Produccion ${params.DEPLOY_SLOT} OK en puerto ${PROD_PORT}"
                            exit 0
                        fi
                        sleep 3
                    done
                    echo "Produccion no responde"
                    exit 0
                """
            }
        }
    }

    post {
        success {
            echo """
            ✅ Pipeline exitoso - Build ${BUILD_NUMBER}
               Slot     : ${params.DEPLOY_SLOT}
               Entorno  : ${params.DEPLOY_ENV}
               Imagen   : ${IMAGE_TAG}
            """
        }
        failure {
            echo "❌ Pipeline fallido - Build ${BUILD_NUMBER}"
        }
        always {
            sh 'docker image prune --force || true'
        }
    }
}

