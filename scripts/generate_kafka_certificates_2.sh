#!/bin/bash

set -o nounset \
    -o errexit

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ROOT_DIR="$SCRIPT_DIR/.."
CERT_DIR="$ROOT_DIR/compose/secrets"

printf "Deleting previous (if any)..."
rm -rf $CERT_DIR
mkdir $CERT_DIR
mkdir -p tmp
echo " OK!"
# Generate CA key
printf "Creating CA..."
openssl req -new -x509 -keyout tmp/datahub-ca.key -out tmp/datahub-ca.crt -days 365 -subj '/CN=ca.datahub/OU=test/O=datahub/L=paris/C=fr' -passin pass:datahub -passout pass:datahub >/dev/null 2>&1

echo " OK!"

for i in 'broker' 'producer' 'consumer' 'schema-registry'
do
	printf "Creating cert and keystore of $i..."
	# Create keystores
	keytool -genkey -noprompt \
				 -alias $i \
				 -dname "CN=$i, OU=test, O=datahub, L=paris, C=fr" \
				 -keystore $CERT_DIR/$i.keystore.jks \
				 -keyalg RSA \
				 -storepass datahub \
				 -keypass datahub  >/dev/null 2>&1

	# Create CSR, sign the key and import back into keystore
	keytool -keystore $CERT_DIR/$i.keystore.jks -alias $i -certreq -file tmp/$i.csr -storepass datahub -keypass datahub >/dev/null 2>&1

	openssl x509 -req -CA tmp/datahub-ca.crt -CAkey tmp/datahub-ca.key -in tmp/$i.csr -out tmp/$i-ca-signed.crt -days 365 -CAcreateserial -passin pass:datahub  >/dev/null 2>&1

	keytool -keystore $CERT_DIR/$i.keystore.jks -alias CARoot -import -noprompt -file tmp/datahub-ca.crt -storepass datahub -keypass datahub >/dev/null 2>&1

	keytool -keystore $CERT_DIR/$i.keystore.jks -alias $i -import -file tmp/$i-ca-signed.crt -storepass datahub -keypass datahub >/dev/null 2>&1

	# Create truststore and import the CA cert.
	keytool -keystore $CERT_DIR/$i.truststore.jks -alias CARoot -import -noprompt -file tmp/datahub-ca.crt -storepass datahub -keypass datahub >/dev/null 2>&1
  echo " OK!"
done

echo "datahub" > $CERT_DIR/cert_creds
rm -rf tmp

echo "SUCCEEDED"
