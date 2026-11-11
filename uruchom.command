#!/bin/bash
# Podglad strony na swoim komputerze: http://localhost:8793
cd "$(dirname "$0")/www" || exit 1
(sleep 1; open "http://localhost:8793") &
php -S localhost:8793
