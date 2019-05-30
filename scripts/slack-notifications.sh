#!/bin/bash

#./slack-notifications.sh -t "Start new CI deployment" -l "http://jenkins.indeema.com/job/UDB/job/Dev-API-PIPE/" -m "Preaparing to new build" -c "GOOD"
SLACK_URL="https://hooks.slack.com/services/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"
PRETEXT="New ticket from Jenkins CI"
TITLE=""
TITLELINK=""
TEXT=""
COLOR="GOOD"

function description {
    programName=$0
    echo "Description: Slack notification sender"
    echo "$programName [-t \"messate title\"] [-l \"title linl\"] [-m \"message body\"] [-c \"color\"]"
    echo "  -t    The title of the message you are posting"
    echo "  -l    The link to source you are posting"
    echo "  -m    The message body"
    echo "  -c    The color type of messge (GOOD, WARNING, DANGARE)"
    exit 1
}

while getopts ":t:l:m:c:h" opt; do
  case ${opt} in
    t) TITLE="$OPTARG"
    ;;
    l) TITLELINK="$OPTARG"
    ;;
    m) TEXT="$OPTARG"
    ;;
    c) COLOR="$OPTARG"
    ;;
    h) description
    ;;
    \?) echo "Invalid option -$OPTARG" >&2
    ;;
esac
done

if [[ ! "${TITLE}" ||  ! "${TITLELINK}" || ! "${TEXT}" || ! "${COLOR}" ]]; then
    echo "Required arguments"
    description
fi

#add color and icon
case ${COLOR} in
  GOOD)
    SLACK_ICON=':slack:'
    COLOR='good'
    ;;
  WARNING)
    SLACK_ICON=':warning:'
    COLOR='warning'
    ;;
  DANGARE)
    SLACK_ICON=':bangbang:'
    COLOR='danger'
    ;;
  *)
    SLACK_ICON=':slack:'
    COLOR='good'
    ;;
esac

read -d '' REQUEST_MESSAGE << EOF
{
  "attachments":[
    {
      "pretext":"${PRETEXT}",
      "title":"${TITLE}",
      "title_link":"${TITLELINK}",
      "text":"${SLACK_ICON} ${TEXT}",
      "color":"${COLOR}"
    }
  ]
}
EOF

#send new message
send=$(curl --write-out %{http_code} --silent --output /dev/null -X POST -H 'Content-type: application/json' --data "${REQUEST_MESSAGE}" ${SLACK_URL})

echo ${REQUEST_MESSAGE}
echo ${send}
