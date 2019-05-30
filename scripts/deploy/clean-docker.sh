#!/bin/bash -x


# docker stop $SERVICE || true && docker rm $SERVICE || true

# docker rmi --unused

# docker ps -q |xargs docker rm
# docker rmi -f $(docker images | grep "<none>" | awk "{print \$3}")
# docker ps -a | grep Exit | cut -d ' ' -f 1 | xargs docker rm

result=`docker images -a | grep -c ".dkr.ecr.us-east-2.amazonaws.com"`

if [[ $result -ne 0 ]]; then
  docker images -a | grep ".dkr.ecr.us-east-2.amazonaws.com" | awk '{print $3}' | xargs docker rmi -f
fi

# docker images -a | grep ".dkr.ecr.us-east-1.amazonaws.com" | awk '{print $3}' | xargs docker rmi -f

# docker images -a | grep ".dkr.ecr.us-east-2.amazonaws.com"