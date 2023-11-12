
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
echo "$0 <list of options delimited by colon>"
echo "$0 -f <file containing list of optons>"
exit 0
fi

if [[ "$1" == "-s" ]] || [[ "$1" == "--single-shot" ]]; then
singleShot=1
shift
fi

if [[ "$1" == "-f" ]]; then
if [[ ! -f "$2" ]]; then
echo "Input file \"$2\" is not present"
exit 1
fi

options=$(cat $2)
else
options="$*"
fi

handler=${!#}
if [[ -f "$handler" ]]; then
if [[ ! -x "$handler" ]]; then
echo "Handler file \"$handler\" found, but lacks executable permissiong, check"
exit 1
else
options=${@:1:$#-1}
fi
else
handler=''
fi

prevChoice='0'

function cleanTmpFile() {
if [[ ! -z "$optionFile" ]] && [[ -e $optionFile ]]; then
rm $optionFile
fi
}

trap cleanTmpFile SIGINT

while :; do

optionFile=$(mktemp)
./menu_driver.sh $optionFile "$prevChoice" "$options"

if [[ -e $optionFile ]]; then
result=$(cat $optionFile)
prevChoice=$(echo $result | cut -d ':' -f 1)
menu="$(echo $result | cut -d ':' -f 2)"
else
prevChoice=0
fi

if [[ $prevChoice -eq 0 ]]; then
exit 0
fi

if [[ ! -z "$handler" ]]; then
$handler "$menu"
fi

if [[ $singleShot -eq 1 ]]; then
exit 0
fi

cleanTmpFile

done
