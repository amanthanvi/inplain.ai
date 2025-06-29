// Stub for Sentry during build
export const captureException = (error: any, context?: any) => {
  console.error('Sentry stub: captureException', error)
}

export const init = (options: any) => {
  console.log('Sentry stub: init')
}

export const configureScope = (callback: any) => {
  console.log('Sentry stub: configureScope')
}

export const withScope = (callback: any) => {
  callback({
    setTag: () => {},
    setContext: () => {},
    setUser: () => {},
  })
}

export default {
  captureException,
  init,
  configureScope,
  withScope,
}