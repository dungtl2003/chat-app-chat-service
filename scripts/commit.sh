#!/bin/sh

# This script is used to write a conventional commit message.
# It prompts the user to choose the type of commit as specified in the
# conventional commit spec. And then prompts for the summary and detailed
# description of the message and uses the values provided. as the summary and
# details of the message.
#
# If you want to add a simpler version of this script to your dotfiles, use:
#
# alias gcm='git commit -m "$(gum input)" -m "$(gum write)"'

# if [ -z "$(git status -s -uno | grep -v '^ ' | awk '{print $2}')" ]; then
#     gum confirm "Stage all?" && git add .
# fi
#
arch_install_gum() {
    if [ -f "/etc/arch-release" ]; then # use arch
      gum confirm "This script needs gum to work. Install gum?" && pacman -S gum
    fi
}

if ! command -v gum &> /dev/null
then
    arch_install_gum
    if ! command -v gum &> /dev/null 
    then
        echo "Gum not found, aborted."
        exit 1
    fi
fi

TYPE=$(gum choose "feat" "fix" "perf" "refactor" "style" "test" "build" "ops" "docs" "chore" "merge" "revert")
SCOPE=$(gum input --placeholder "scope")

# Since the scope is optional, wrap it in parentheses if it has a value.
test -n "$SCOPE" && SCOPE="($SCOPE)"

# Pre-populate the input with the type(scope): so that the user may change it
SUMMARY=$(gum input --value "$TYPE$SCOPE: " --placeholder "Summary of this change")
DESCRIPTION=$(gum write --placeholder "Details of this change")

# Commit these changes if user confirms
gum confirm "Commit changes?" && git commit -m "$SUMMARY" -m "$DESCRIPTION"
