/*
 * `virtual:react-router/server-build` is aliased by `@react-router/dev` to the
 * generated server build. It is declared here so `tsc` can check the Workers
 * entry before a build has produced `.react-router/types`.
 */
declare module 'virtual:react-router/server-build' {
  const build: unknown;

  export default build;
}
