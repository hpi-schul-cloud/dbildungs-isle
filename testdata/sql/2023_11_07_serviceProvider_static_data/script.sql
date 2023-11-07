INSERT INTO service_provider (id, created_at, updated_at, name, url, provided_on_schulstrukturknoten)
VALUES (1, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 'Email', 'https://de.wikipedia.org/wiki/E-Mail', 1);

INSERT INTO service_provider (id, created_at, updated_at, name, url, provided_on_schulstrukturknoten)
VALUES (2, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 'itslearning', 'https://sh.itslearning.com/', 1);

INSERT INTO rolle (id, created_at, updated_at, administered_by_schulstrukturknoten)
VALUES (1, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 1);

INSERT INTO rolle_recht (id, created_at, updated_at, type, service_provider)
VALUES (1, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 'serviceProviderZugriff', 1);

INSERT INTO rolle_recht (id, created_at, updated_at, type, service_provider)
VALUES (2, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 'serviceProviderZugriff', 2);

INSERT INTO rolle_recht (id, created_at, updated_at, type, service_provider)
VALUES (3, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 'systemZugriff', null);

INSERT INTO rolle_berechtigungszuweisung (id, created_at, updated_at, valid_for_organisational_children, valid_for_administrative_parents, rolle_recht_id, rolle_id, schulstrukturknoten)
VALUES (1, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', false, false, 1, 1, 1);

INSERT INTO rolle_berechtigungszuweisung (id, created_at, updated_at, valid_for_organisational_children, valid_for_administrative_parents, rolle_recht_id, rolle_id, schulstrukturknoten)
VALUES (2, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', false, false, 2, 1, 1);

INSERT INTO person_rollenzuweisung (id, created_at, updated_at, person, rolle_id, schulstrukturknoten)
VALUES (1, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 1, 1, 1);

INSERT INTO data_provider (id, created_at, updated_at)
VALUES (1, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00');

INSERT INTO person (id, created_at, updated_at, keycloak_user_id, referrer, client, main_organization, last_name, first_name, initials_last_name, initials_first_name, nick_name, name_title, name_salutation, name_prefix, name_suffix, name_sort_index, birth_date, birth_place, gender, localization, trust_level, is_information_blocked, data_provider_id)
VALUES (1, '2023-11_07 02:17:02+00:00', '2023-11_07 02:17:02+00:00', 'dfd30355-50ca-4edc-be4d-c495df4fb8f6', null, 'client', null, 'Experimentus', 'Testus', null, null, 'test-user', null, null, null, null, null, '2003-10-18 02:17:02+00:00', 'Hamburg', 'female', 'de', 'none', false, 1);
