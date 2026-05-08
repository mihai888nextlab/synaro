import Dockerode from 'dockerode'

// Connects to Docker daemon via Unix socket (Linux/WSL) or named pipe (Windows)
export const docker = new Dockerode(
  process.platform === 'win32'
    ? { socketPath: '//./pipe/docker_engine' }
    : { socketPath: '/var/run/docker.sock' }
)
