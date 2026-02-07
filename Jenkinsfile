pipeline {
    agent any

    environment {
        // Node.js environment
        NODE_VERSION = '20'
        PNPM_VERSION = '9'

        // Build paths
        WORKSPACE_DIR = "${WORKSPACE}"
        BUILD_OUTPUT = "${BUILD_URL}artifact/output"
    }

    options {
        skipDefaultCheckout()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    echo "Branch: ${env.BRANCH_NAME}"
                    echo "Commit: ${GIT_COMMIT.take(8)}"
                }
            }
        }

        stage('Setup Node.js') {
            steps {
                nvm(nodeVersion: NODE_VERSION) {
                    sh 'node --version'
                    sh 'npm install -g pnpm@${PNPM_VERSION}'
                    sh 'pnpm --version'
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Type Check') {
            steps {
                sh 'pnpm run typecheck'
            }
        }

        stage('Lint') {
            steps {
                sh 'pnpm run lint'
            }
            post {
                always {
                    recordIssues(
                        tools: [eslint(pattern: 'node_modules/.cache/eslint/**/*')]
                    )
                }
            }
        }

        stage('Test') {
            steps {
                sh 'pnpm run test'
            }
            post {
                always {
                    junit 'junit.xml'
                    publishHTML([
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }

        stage('Build') {
            steps {
                sh 'pnpm run build'
            }
            archiveArtifacts(
                artifacts: 'build/**/*',
                fingerprint: true,
                allowEmptyArchive: true
            )
        }

        stage('Docker Validation') {
            steps {
                script {
                    echo 'Validating Docker production build...'
                    sh 'docker build --target bolt-ai-production . --no-cache --progress=plain'
                    echo '✅ Production target builds successfully'
                }
            }
        }

        stage('Docker Development Build') {
            steps {
                script {
                    echo 'Validating Docker development build...'
                    sh 'docker build --target development . --no-cache --progress=plain'
                    echo '✅ Development target builds successfully'
                }
            }
        }

        stage('Docker Compose Validation') {
            steps {
                script {
                    echo 'Validating docker-compose configuration...'
                    sh 'docker compose config --quiet'
                    echo '✅ docker-compose configuration is valid'
                }
            }
        }

        stage('Electron Build (Optional)') {
            when { branch 'main' }
            steps {
                sh 'pnpm run electron:build:deps || true'
            }
        }
    }

    post {
        success {
            emailext(
                subject: "✅ Build Successful: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                    <h2>Build Successful</h2>
                    <p><b>Job:</b> ${env.JOB_NAME}</p>
                    <p><b>Build:</b> #${env.BUILD_NUMBER}</p>
                    <p><b>Branch:</b> ${env.BRANCH_NAME}</p>
                    <p><b>Duration:</b> ${currentBuild.durationString}</p>
                    <p><b>Status:</b> SUCCESS</p>
                    <p><b>Console:</b> <a href="${env.BUILD_URL}console">View Console</a></p>
                """,
                mimeType: 'text/html',
                recipientProviders: [[$class: 'RequesterRecipientProvider']]
            )
        }

        failure {
            emailext(
                subject: "❌ Build Failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                    <h2>Build Failed</h2>
                    <p><b>Job:</b> ${env.JOB_NAME}</p>
                    <p><b>Build:</b> #${env.BUILD_NUMBER}</p>
                    <p><b>Branch:</b> ${env.BRANCH_NAME}</p>
                    <p><b>Duration:</b> ${currentBuild.durationString}</p>
                    <p><b>Status:</b> FAILED</p>
                    <p><b>Console:</b> <a href="${env.BUILD_URL}console">View Console</a></p>
                    <p><b>Error:</b> ${currentBuild.rawBuild?.description ?: 'See console output'}</p>
                """,
                mimeType: 'text/html',
                recipientProviders: [[$class: 'RequesterRecipientProvider']]
            )
        }

        unstable {
            emailext(
                subject: "⚠️ Build Unstable: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                    <h2>Build Unstable</h2>
                    <p><b>Job:</b> ${env.JOB_NAME}</p>
                    <p><b>Build:</b> #${env.BUILD_NUMBER}</p>
                    <p><b>Branch:</b> ${env.BRANCH_NAME}</p>
                    <p><b>Duration:</b> ${currentBuild.durationString}</p>
                    <p><b>Console:</b> <a href="${env.BUILD_URL}console">View Console</a></p>
                """,
                mimeType: 'text/html',
                recipientProviders: [[$class: 'RequesterRecipientProvider']]
            )
        }

        always {
            cleanWs(
                cleanWhenAborted: true,
                cleanWhenFailure: true,
                cleanWhenNotBuilt: true,
                cleanWhenSuccess: true,
                deleteDirs: true,
                notFailBuild: true,
                patterns: [
                    [pattern: '.gitignore', type: 'EXCLUDE'],
                    [pattern: 'build/**/*', type: 'EXCLUDE'],
                    [pattern: 'coverage/**/*', type: 'EXCLUDE']
                ]
            )
        }
    }
}

