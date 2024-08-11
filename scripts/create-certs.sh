#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ROOT_DIR="$SCRIPT_DIR/.."
SECRETS_DIR=${SECRETS_DIR:="$ROOT_DIR/environments/test/secrets"}

VALIDITY_IN_DAYS=3650

CA_KEY_FILE="chatapp-ca.key"
CA_CERT_FILE="chatapp-ca.crt"
KEYSTORE_FILE="broker.keystore.jks"
KEYSTORE_SIGN_REQUEST_FILE="broker.csr"
KEYSTORE_SIGNED_CERT_FILE="broker-ca-signed.crt"
TRUSTSTORE_FILE="broker.truststore.jks"

CRED="123456a@"
CRED_FILE="cert_creds"

set -o nounset \
    -o errexit

printf "Deleting previous (if any)..."
rm -rf $SECRETS_DIR
mkdir -p $SECRETS_DIR
mkdir -p tmp
echo " OK!"
# Generate CA key
printf "Creating CA..."
openssl req -new -x509 -keyout tmp/$CA_KEY_FILE -out tmp/$CA_CERT_FILE -days $VALIDITY_IN_DAYS -subj '/CN=ca.test/O=test/L=HaNoi/C=VN' -passin pass:$CRED -passout pass:$CRED >/dev/null 2>&1

echo " OK!"

# for i in 'broker' 'broker-2' 'producer' 'consumer' 'schema-registry'
# do
# 	printf "Creating cert and keystore of $i..."
# 	# Create keystores
# 	keytool -genkey -noprompt \
# 				 -alias $i \
# 				 -dname "CN=$i, OU=test, O=datahub, L=paris, C=fr" \
# 				 -keystore secrets/$i.keystore.jks \
# 				 -keyalg RSA \
# 				 -storepass datahub \
# 				 -keypass datahub  >/dev/null 2>&1
#
# 	# Create CSR, sign the key and import back into keystore
# 	keytool -keystore secrets/$i.keystore.jks -alias $i -certreq -file tmp/$i.csr -storepass datahub -keypass datahub >/dev/null 2>&1
#
# 	openssl x509 -req -CA tmp/datahub-ca.crt -CAkey tmp/datahub-ca.key -in tmp/$i.csr -out tmp/$i-ca-signed.crt -days 365 -CAcreateserial -passin pass:datahub  >/dev/null 2>&1
#
# 	keytool -keystore secrets/$i.keystore.jks -alias CARoot -import -noprompt -file tmp/datahub-ca.crt -storepass datahub -keypass datahub >/dev/null 2>&1
#
# 	keytool -keystore secrets/$i.keystore.jks -alias $i -import -file tmp/$i-ca-signed.crt -storepass datahub -keypass datahub >/dev/null 2>&1
#
# 	# Create truststore and import the CA cert.
# 	keytool -keystore secrets/$i.truststore.jks -alias CARoot -import -noprompt -file tmp/datahub-ca.crt -storepass datahub -keypass datahub >/dev/null 2>&1
#   echo " OK!"
# done
printf "Creating cert and keystore of broker..."
# Create keystores
keytool -genkeypair -noprompt \
             -alias broker \
             -dname "CN=*.test, O=test, L=HaNoi, C=VN" \
             -keystore $SECRETS_DIR/$KEYSTORE_FILE \
             -keyalg RSA \
             -storepass $CRED \
             -keypass $CRED  >/dev/null 2>&1

# Create CSR, sign the key and import back into keystore
keytool -keystore $SECRETS_DIR/$KEYSTORE_FILE -alias broker -certreq -file tmp/$KEYSTORE_SIGN_REQUEST_FILE -storepass $CRED -keypass $CRED >/dev/null 2>&1

openssl x509 -req -CA tmp/$CA_CERT_FILE -CAkey tmp/$CA_KEY_FILE -in tmp/$KEYSTORE_SIGN_REQUEST_FILE -out tmp/$KEYSTORE_SIGNED_CERT_FILE -days $VALIDITY_IN_DAYS -CAcreateserial -passin pass:$CRED  >/dev/null 2>&1

keytool -keystore $SECRETS_DIR/$KEYSTORE_FILE -alias CARoot -import -noprompt -file tmp/$CA_CERT_FILE -storepass $CRED -keypass $CRED >/dev/null 2>&1

keytool -keystore $SECRETS_DIR/$KEYSTORE_FILE -alias broker -import -file tmp/$KEYSTORE_SIGNED_CERT_FILE -storepass $CRED -keypass $CRED >/dev/null 2>&1

# Create truststore and import the CA cert.
keytool -keystore $SECRETS_DIR/$TRUSTSTORE_FILE -alias CARoot -import -noprompt -file tmp/$CA_CERT_FILE -storepass $CRED -keypass $CRED >/dev/null 2>&1

echo " OK!"

echo $CRED > $SECRETS_DIR/$CRED_FILE
rm -rf tmp

echo "SUCCEEDED"
