#!/bin/bash

set -e

cp questions/*.csv questions/tsv
cd questions/tsv

cat *.csv > bulk_import.tsv
rm *.csv

sed -i 's|\^|\t|g' bulk_import.tsv

sed = bulk_import.tsv | sed 'N;s/\n/\t/' > temp_file
mv temp_file bulk_import.tsv

mongoimport --db riddler --collection questions --type tsv --fields qid,category,question,answer --file bulk_import.tsv
