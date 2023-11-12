#!/bin/sh

choice=0
maxChoice=-1
prevChoice=-1
navChoice=1
declare -A menuMap
menuMap[1]=1

if [[ $# -le 1 ]]; then
echo "Pass <file_to_store_option> as first arg and ':' separated list of options"
exit 1
fi

# If first arg is a tmp file (where the caller wants to read the choice entered by user)
# confirm if it is indeed a tmp file and shift the args
outputFile=$1
if [[ -f $outputFile ]] && [[ $outputFile =~ ^/tmp/tmp.* ]]; then
shift
fi

if [[ $1 =~ ^[0-9]+$ ]]; then
prevChoice=$1
navChoice=$1
shift
fi

inputList=$(echo $* | sed -e 's/ /<SPACE>/g' -e 's/:/ /g')

displayMenu() {
idx=1
menuList=$1

#clear
for menu in $menuList;do
menuMap[$idx]="$(echo $menu | sed 's/<SPACE>/ /g')"

if [[ $prevChoice -eq $idx ]]; then # Previously chose option
echo -n "*"
elif [[ $navChoice -eq $idx ]]; then # Provisional option i.e in the process of navigating using keys
echo -n "-"
else
echo -n " "
fi

printf "%2d : %s\n" $idx "${menuMap[$idx]}"
idx=$((idx+1))
done
echo "  0 : Exit"

if [[ $maxChoice -eq -1 ]]; then
maxChoice=$((idx-1))
fi
}

while :; do

displayMenu "$inputList"

read -e -p "Choose the option : " choice

case $choice in
0)
exit 0
;;

"")
if [[ ! -z "$navChoice" ]] && [[ $navChoice -ge 1 ]] && [[ $navChoice -le $maxChoice ]]; then
choice=$navChoice
prevChoice=$navChoice
break
fi
;;

[up])
if [[ $navChoice -gt 1 ]]; then
navChoice=$((navChoice-1))
else
navChoice=$maxChoice
fi
;;

[dn])
if [[ $navChoice -lt $maxChoice ]]; then
navChoice=$((navChoice+1))
else
navChoice=1
fi
;;

*)
if [[ $choice -ge 1 ]] && [[ $choice -le $maxChoice ]]; then
prevChoice=$choice
navChoice=$choice
break
else
echo "Incorrect option, try again"
sleep 1
continue
fi
;;

esac

done

echo "$choice:${menuMap[$choice]}" > $outputFile
