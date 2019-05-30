#!/bin/bash -x

branch=$(git rev-parse --abbrev-ref HEAD)
commit=$(git log --source -1 --pretty=%B)
#echo $commit
if [[ $branch != "production" ]]; then
  echo 1
  #exit 1;
else
  if [[ $commit != *"[ci start $SERVICE]"* ]]; then
    echo 1
  fi
fi
