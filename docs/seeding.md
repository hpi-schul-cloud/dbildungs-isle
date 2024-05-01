# Seeding data

Seeding of data for all environments is done via JSON files per entity-type or aggregate.

- files for local execution when developing on the project are stored in `seeding/dev`

- files for integration tests and unit-tests of the seeding mechanism itself are stored in `seeding/seeding-integration-test`

- files for seeding in the different Kubernetes environments are stored in `charts/dbildungs-iam-server/seeding/dev`

## Referencing

Some data is referencing other data, e.g. ServiceProvider are provided by SchulstrukturKnoten and therefore have an attribute _providedOnSchulstrukturknoten_.
At the moment there is a transition going on. In the past attributes like _providedOnSchulstrukturknoten_ would have been the exact ID/UUID
of the record in another table in the DB.
To create a more flexible and less hard-coded way of seeding data, the new approach is to use (virtual) seeding-IDs which are only valid
in the seeding-files and will be interpreted only during the seeding process and by services of the seeding mechanism.

At the moment following types of seeding-files use the old approach with concrete IDs/UUIDs: `ServiceProvider`, `DataProvider`.
The other files are using the new approach, e.g. Rollen, Personen and Organisationen are referenced in Personenkontext by virtual seeding-IDs.

## Format of seeding-files

Every seeding-file has two attributes:
- entityName: type of the entity used for the entities (this must match the current list of defined types in _db-seed.console.ts_)
- entities: list of all entities to be seeded

Example for a seeding-file for service-providers (old way of referencing)

```json
{
    "entityName": "ServiceProvider",
    "entities": [
        {
            "name": "itslearning",
            "url": "https://itslearning.com/de",
            "kategorie": "UNTERRICHT",
            "providedOnSchulstrukturknoten": "d39cb7cf-2f9b-45f1-849f-973661f2f057"
        },
        {
            "name": "E-Mail",
            "url": "https://de.wikipedia.org/wiki/E-Mail",
            "kategorie": "EMAIL",
            "logoMimeType": "image/png",
            "logoBase64": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEfSURBVGhD7dXBCcMwEERR999cSkgpDny+wSAwgjjaSJ53HO9KmpO3fXIpUC0FqqVAtRSolgLV1iqwTcLnIgUq+Fw8o8DrxNGf8Rp4fcNRpMDdvAZe33AU6xbwDBjhfeLa1zwOXgOvhxFcQwrcwePgNfB6GME1rFvACJ4NP8MIjnZzDR4HIzgKP8MIKXBwtJtr8DgYwVH4GUZ4RoEzz4ajMIKjDT/DNRjB0YajMEIKHIzgaMPPcA1GcLThKIzwvAJn/mPgWjfX4HGXXIMRUuDgWjfX4HGXXIMRnl1gJJ8FI6TAKD4LRkiBUXwWjJACo/gsGCEFRvFZMEIKjOKzYIR1C/wzn4sUqOBzsVaBGaVAtRSolgLVUqBaClSbvMC+fwCAXOqd0zaBMgAAAABJRU5ErkJggg==",
            "providedOnSchulstrukturknoten": "d39cb7cf-2f9b-45f1-849f-973661f2f057"
        }
    ]
}
```

Example for a seeding-file for organisations (new way of referencing)
```json
{
    "entityName": "Organisation",
    "entities": [
        {
            "id": 0,
            "kennung": "Root",
            "name": "Root Organisation",
            "kuerzel": "Root",
            "typ": "TRAEGER",
            "administriertVon": null,
            "zugehoerigZu": null
        },
        {
            "id": 1,
            "kennung": "Organisation1",
            "name": "Träger1",
            "namensergaenzung": "Keine",
            "kuerzel": "O1",
            "typ": "TRAEGER",
            "administriertVon": 0,
            "zugehoerigZu": 0
        }
    ]
}
```

## Execution of seeding

Advice: In general running `npm run db:init` before seeding is recommended.

The command for seeding is:
`npm run db:seed $DIRECTORY $LIST_OF_FILES_TO_EXCLUDE`

- $DIRECTORY: is mandatory
- $LIST_OF_FILES_TO_EXCLUDE is optional

### Examples of use:
If you want to use custom seeding-files in a directory seeding/MySeedingFiles, execute:
`npm run db:seed MySeedingFiles`

If you want to exclude the seeding file 05_personenkontext.json in that directory from the seeding, execute:
`npm run db:seed MySeedingFiles 05_personenkontext.json`

If you want to exclude another file from seeding, execute:
`npm run db:seed MySeedingFiles 05_personenkontext.json,06_anothertype.json`
