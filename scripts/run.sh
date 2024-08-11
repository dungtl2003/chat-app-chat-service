#!/usr/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ROOT_DIR="$SCRIPT_DIR/.."

ENV=${ENV:-"dev"};
ENV_PATH=${ENV_PATH:-"$ROOT_DIR/environments/$ENV/.env"}

export_envs() {
    for line in "${lines[@]}"; do
        printf "export %s\n" $line;
        export $line;
    done
}

clean_envs() {
    for line in "${lines[@]}"; do
        pair=(${line//=/ })
        printf "unset %s\n" ${pair[0]};
        unset ${pair[0]};
    done
}

read_file() {
    IFS=$'\n' read -d '' -r -a lines < ${ENV_PATH};
}

run_cmd_with_envs() {
    read_file;
    export_envs;
    exec_cmd "$@";
    clean_envs;
}

exec_cmd() {
    local args="$@";
    printf "executing command: %s\n" "$args";
    $args;
}

main() {
    if [ -f ${ENV_PATH} ]; then
        printf "%s: env file found\n" "$ENV_PATH";
        run_cmd_with_envs "$@";
    else
        printf "%s: env file not found\n" "$ENV_PATH";
        exec_cmd "$@";
    fi
}

main "$@";
