# LDAP

The LDAP image used in the project is the `osixia/openldap`.

## Configuration

The initial LDIF file loaded is located in `config/ldif`.

Because the openldap service is not attached to a special network, it is directly accessible on ldap://localhost with ldap-commands or
via the ldap client library functions (ldapts).

### Useful commands:

- Add a new entry, based on certain file
```bash
ldapadd -x -H ldap://localhost -D "cn=admin,dc=example,dc=org" -f config/02_spsh.ldif -W
```

- Search all entries from BASE_DN `dc=example,dc=org` downwards:
```bash
ldapsearch -H ldap://localhost -b "dc=example,dc=org" -x -D "cn=admin,dc=example,dc=org" -W
```
