-- noinspection SqlNoDataSourceInspectionForFile

INSERT INTO service_provider (id, created_at, updated_at, name, url, provided_on_schulstrukturknoten)
VALUES (1, NOW(), NOW(), 'Email', 'https://de.wikipedia.org/wiki/E-Mail', 1);

INSERT INTO service_provider (id, created_at, updated_at, name, url, provided_on_schulstrukturknoten)
VALUES (2, NOW(), NOW(), 'itslearning', 'https://sh.itslearning.com/', 1);

INSERT INTO rolle (id, created_at, updated_at, administered_by_schulstrukturknoten)
VALUES (1, NOW(), NOW(), 1);

INSERT INTO rolle_recht (id, created_at, updated_at, type, service_provider)
VALUES (1, NOW(), NOW(), 'serviceProviderZugriff', 1);

INSERT INTO rolle_recht (id, created_at, updated_at, type, service_provider)
VALUES (2, NOW(), NOW(), 'serviceProviderZugriff', 2);

INSERT INTO rolle_recht (id, created_at, updated_at, type, service_provider)
VALUES (3, NOW(), NOW(), 'systemZugriff', null);

INSERT INTO rolle_berechtigungszuweisung (id, created_at, updated_at, valid_for_organisational_children, valid_for_administrative_parents, rolle_recht_id, rolle_id, schulstrukturknoten)
VALUES (1, NOW(), NOW(), false, false, 1, 1, 1);

INSERT INTO rolle_berechtigungszuweisung (id, created_at, updated_at, valid_for_organisational_children, valid_for_administrative_parents, rolle_recht_id, rolle_id, schulstrukturknoten)
VALUES (2, NOW(), NOW(), false, false, 2, 1, 1);

INSERT INTO person_rollenzuweisung (id, created_at, updated_at, person, rolle_id, schulstrukturknoten)
VALUES (1, NOW(), NOW(), 1, 1, 1);

INSERT INTO data_provider (id, created_at, updated_at)
VALUES (1, NOW(), NOW());

INSERT INTO person (id, created_at, updated_at, keycloak_user_id, referrer, mandant, stammorganisation, familienname, vorname, initialen_familienname, initialen_vorname, rufname, name_titel, name_anrede, name_praefix, name_suffix, name_sortierindex, geburtsdatum, geburtsort, geschlecht, lokalisierung, vertrauensstufe, auskunftssperre, data_provider_id)
VALUES (1, NOW(), NOW(),
'df9b5e32-0772-4346-aea4-6fdd277b9c40', null, 'client', null, 'Experimentus', 'Testus', null, null, 'test-user', null, null, null, null, null, NOW(), 'Hamburg', 'w', 'de', 'KEIN', false, 1);
