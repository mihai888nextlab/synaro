import Dockerode from 'dockerode'

export const docker = new Dockerode(
  process.platform === 'win32'
    ? { socketPath: '//./pipe/docker_engine' }
    : { socketPath: '/var/run/docker.sock' }
)
