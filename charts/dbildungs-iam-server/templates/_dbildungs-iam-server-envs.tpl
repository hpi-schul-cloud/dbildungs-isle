{{- define "dbildungs-iam-server-backend-envs" }}
          - name: DB_SECRET
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: db-password
          - name: DB_USERNAME
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: db-username
          - name: DB_HOST
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: db-host
          - name: KC_ADMIN_SECRET
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: keycloak-adminSecret
          - name: DB_CLIENT_URL
            value: "postgres://$(DB_HOST)/"
          - name: KC_CLIENT_SECRET
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: keycloak-clientSecret
          - name: FRONTEND_SESSION_SECRET
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: frontend-sessionSecret
          - name: ITSLEARNING_ENABLED
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: itslearning-enabled
          - name: ITSLEARNING_ENDPOINT
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: itslearning-endpoint
          - name: ITSLEARNING_USERNAME
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: itslearning-username
          - name: ITSLEARNING_PASSWORD
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: itslearning-password
          - name: LDAP_ADMIN_PASSWORD
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: ldap-admin-password
          - name: PI_BASE_URL
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: pi-base-url
          - name: PI_ADMIN_USER
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: pi-admin-user
          - name: PI_ADMIN_PASSWORD
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: pi-admin-password
          - name: PI_USER_RESOLVER
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: pi-user-resolver
          - name: PI_REALM
            valueFrom:
              secretKeyRef:
                  name: {{ default .Values.auth.existingSecret .Values.auth.secretName }}
                  key: pi-user-realm
{{- end}}
