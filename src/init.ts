/**
 * Contains template configurations for Zerops projects
 */

/**
 * Default zerops.yml configuration for deploying applications
 */
export const ZEROPS_YML = `zerops:
  - setup: app
    # ==== how to build your application ====
    build:
      # what technologies should the build
      # container be based on (can be an array)
      base: nodejs@22

      # what commands to use to build your app
      buildCommands:
        - npm i
        - npm run build

      # select which files / folders to deploy
      # after the build successfully finished
      deployFiles:
        - dist
        - package.json
        - node_modules

      # *optional*: which files / folders
      # to cache for the next build run
      cache:
        - node_modules
        - package-lock.json

    # ==== how to run your application ====
    run:
      # what technology should the runtime
      # container be based on, can be extended
      # in run.prepareCommands using
      # - zsc install nodejs@20
      base: nodejs@22

      # what ports your app listens on
      # and whether it supports http traffic
      ports:
        - port: 3000
          httpSupport: true

      # how to start your application
      start: npm start`;

export const IMPORT_YML = `#yamlPreprocessor=on
project:
  name: project
services:
  - hostname: app
    type: nodejs@latest
    buildFromGit: https://github.com/example/app
    enableSubdomainAccess: true
    envSecrets:
      # yamlPreprocessor feat: generates a random 64 char and stores it
      SECRET_KEY: <@generateRandomString(<64>)>
    
  - hostname: db
    type: postgresql@16
    mode: HA`;