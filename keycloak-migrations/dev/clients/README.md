# Keycloak Client Updates

This folder contains `.json` files to update the keycloak clients.

The files should be named `<uuid-of-the-client>.json` and contain a `ClientRepresentation` (see [https://www.keycloak.org/docs-api/latest/rest-api/index.html#ClientRepresentation](https://www.keycloak.org/docs-api/latest/rest-api/index.html#ClientRepresentation))

These files are used for both local setup (i.e. using `npm run setup`) as well as the deployment cluster. If these need to be seperated, the command that is executed in the [backend-deployment.yaml](/charts/dbildungs-iam-server/templates/backend-deployment.yaml) should be changed to use a different folder.
