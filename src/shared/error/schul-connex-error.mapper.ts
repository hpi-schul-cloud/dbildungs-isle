import { HttpException } from '@nestjs/common';
import { DomainError } from './domain.error.js';
import { EntityCouldNotBeCreated } from './entity-could-not-be-created.error.js';
import { EntityCouldNotBeUpdated } from './entity-could-not-be-updated.error.js';
import { EntityNotFoundError } from './entity-not-found.error.js';
import { KeycloakClientError } from './keycloak-client.error.js';
import { MismatchedRevisionError } from './mismatched-revision.error.js';
import { PersonAlreadyExistsError } from './person-already-exists.error.js';
import { SchulConnexError } from './schul-connex.error.js';
import { EntityCouldNotBeDeleted } from './entity-could-not-be-deleted.error.js';
import { EntityAlreadyExistsError } from './entity-already-exists.error.js';
import { AddSystemrechtError } from './add-systemrecht.error.js';
import { ZyklusInOrganisationenError } from '../../modules/organisation/specification/error/zyklus-in-organisationen.error.js';
import { RootOrganisationImmutableError } from '../../modules/organisation/specification/error/root-organisation-immutable.error.js';
import { NurKlasseKursUnterSchuleError } from '../../modules/organisation/specification/error/nur-klasse-kurs-unter-schule.error.js';
import { SchuleUnterTraegerError } from '../../modules/organisation/specification/error/schule-unter-traeger.error.js';
import { TraegerInTraegerError } from '../../modules/organisation/specification/error/traeger-in-traeger.error.js';
import { InvalidCharacterSetError } from './invalid-character-set.error.js';
import { InvalidAttributeLengthError } from './invalid-attribute-length.error.js';
import { InvalidNameError } from './invalid-name.error.js';
import { KennungRequiredForSchuleError } from '../../modules/organisation/specification/error/kennung-required-for-schule.error.js';
import { NurLehrUndLernAnKlasseError } from '../../modules/personenkontext/specification/error/nur-lehr-und-lern-an-klasse.error.js';
import { GleicheRolleAnKlasseWieSchuleError } from '../../modules/personenkontext/specification/error/gleiche-rolle-an-klasse-wie-schule.error.js';
import { KlasseNurVonSchuleAdministriertError } from '../../modules/organisation/specification/error/klasse-nur-von-schule-administriert.error.js';
import { KlassenNameAnSchuleEindeutigError } from '../../modules/organisation/specification/error/klassen-name-an-schule-eindeutig.error.js';

export class SchulConnexErrorMapper {
    private static SCHULCONNEX_ERROR_MAPPINGS: Map<string, SchulConnexError> = new Map([
        [
            EntityCouldNotBeCreated.name,
            new SchulConnexError({
                code: 500,
                subcode: '00',
                titel: 'Interner Serverfehler',
                beschreibung: 'Es ist ein interner Fehler aufgetreten. Entität konnte nicht erstellt werden.',
            }),
        ],
        [
            EntityCouldNotBeUpdated.name,
            new SchulConnexError({
                code: 500,
                subcode: '00',
                titel: 'Interner Serverfehler',
                beschreibung: 'Es ist ein interner Fehler aufgetreten. Entität konnte nicht aktualisiert werden.',
            }),
        ],
        [
            EntityCouldNotBeDeleted.name,
            new SchulConnexError({
                code: 500,
                subcode: '00',
                titel: 'Interner Serverfehler',
                beschreibung: 'Es ist ein interner Fehler aufgetreten. Entität konnte nicht gelöscht werden.',
            }),
        ],
        [
            EntityNotFoundError.name,
            new SchulConnexError({
                code: 404,
                subcode: '01',
                titel: 'Angefragte Entität existiert nicht',
                beschreibung: 'Die angeforderte Entität existiert nicht',
            }),
        ],
        [
            KeycloakClientError.name,
            new SchulConnexError({
                code: 500,
                subcode: '00',
                titel: 'Interner Serverfehler',
                beschreibung: 'Es ist ein interner Fehler aufgetreten. Ein Keycloak Fehler ist aufgetreten.',
            }),
        ],
        [
            MismatchedRevisionError.name,
            new SchulConnexError({
                code: 409,
                subcode: '00',
                titel: 'Konflikt mit dem aktuellen Zustand der Resource',
                beschreibung:
                    'Die Entität wurde eventuell durch Dritte verändert. Die Revisionsnummer stimmt nicht überein.',
            }),
        ],
        [
            PersonAlreadyExistsError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Fehlerhafte Anfrage',
                beschreibung: 'Die Anfrage ist fehlerhaft: Die Person existiert bereits.',
            }),
        ],
        [
            EntityAlreadyExistsError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Fehlerhafte Anfrage',
                beschreibung: 'Die Anfrage ist Fehlerhaft: Die Entität existiert bereits.',
            }),
        ],
        [
            AddSystemrechtError.name,
            new SchulConnexError({
                code: 500,
                subcode: '00',
                titel: 'Fehlerhafte Anfrage',
                beschreibung: 'Systemrecht konnte Rolle nicht hinzugefügt werden.',
            }),
        ],
        [
            KennungRequiredForSchuleError.name,
            new SchulConnexError({
                code: 400,
                subcode: '01',
                titel: 'Fehlerhafte Anfrage',
                beschreibung: "Das Feld 'kennung' darf nicht leer sein, wenn der Organisationstyp 'SCHULE' ist.",
            }),
        ],
        [
            SchuleUnterTraegerError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Organisation nicht erfüllt',
                beschreibung: 'Schulen können nur Trägern zugeordnet / von Trägern administriert werden.',
            }),
        ],
        [
            TraegerInTraegerError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Organisation nicht erfüllt',
                beschreibung: 'Träger können nur Trägern zugeordnet / von diesen administriert werden.',
            }),
        ],
        [
            NurKlasseKursUnterSchuleError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Organisation nicht erfüllt',
                beschreibung: 'Nur Klassen und Kurse können zugehörig sein oder administriert werden von Schulen.',
            }),
        ],
        [
            ZyklusInOrganisationenError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Organisation nicht erfüllt',
                beschreibung:
                    'Die administriertVon- oder zugehörigZu-Beziehung kann nicht erstellt werden, da keine Zyklen erlaubt sind.',
            }),
        ],
        [
            RootOrganisationImmutableError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Organisation nicht erfüllt',
                beschreibung: 'Die Root-Organisation ist bzgl. administriertVon und zugehörigZu unveränderlich.',
            }),
        ],
        [
            KlasseNurVonSchuleAdministriertError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Organisation nicht erfüllt',
                beschreibung: 'Eine Klasse kann nur von einer Schule administriert werden.',
            }),
        ],
        [
            KlassenNameAnSchuleEindeutigError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Organisation nicht erfüllt',
                beschreibung: 'Der Klassen-Name muss pro Schule eindeutig sein.',
            }),
        ],
        [
            InvalidAttributeLengthError.name,
            new SchulConnexError({
                code: 400,
                subcode: '07',
                titel: 'Attributwerte haben eine ungültige Länge',
                beschreibung: 'Textlänge ist nicht valide',
            }),
        ],
        [
            InvalidCharacterSetError.name,
            new SchulConnexError({
                code: 400,
                subcode: '08',
                titel: 'Attributwerte entsprechen nicht dem gültigen Zeichensatz',
                beschreibung: 'Text entspricht nicht dem Zeichensatz',
            }),
        ],
        [
            InvalidNameError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Fehlerhafte Anfrage',
                beschreibung: 'Die Anfrage ist fehlerhaft: Es konnte kein Benutzername generiert werden',
            }),
        ],
        [
            NurLehrUndLernAnKlasseError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Personenkontext nicht erfüllt',
                beschreibung: 'Nur Lehrer und Lernende können Klassen zugeordnet werden.',
            }),
        ],
        [
            GleicheRolleAnKlasseWieSchuleError.name,
            new SchulConnexError({
                code: 400,
                subcode: '00',
                titel: 'Spezifikation von Personenkontext nicht erfüllt',
                beschreibung:
                    'Die Rollenart der Person muss für die Klasse dieselbe sein wie an der zugehörigen Schule.',
            }),
        ],
    ]);

    private static NO_MAPPING_FOUND: SchulConnexError = new SchulConnexError({
        code: 500,
        subcode: '00',
        titel: 'Interner Serverfehler',
        beschreibung: 'Es ist ein interner Fehler aufgetreten. Der aufgetretene Fehler konnte nicht verarbeitet werden',
    });

    public static mapSchulConnexErrorToHttpException(error: SchulConnexError): HttpException {
        return new HttpException(error, error.code);
    }

    public static mapDomainErrorToSchulConnexError(error: DomainError): SchulConnexError {
        return this.SCHULCONNEX_ERROR_MAPPINGS.get(error.constructor.name) ?? this.NO_MAPPING_FOUND;
    }
}
