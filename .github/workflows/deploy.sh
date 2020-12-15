export REPO=wowanalyzer/wowanalyzer-server;
export DEPLOY_TAG=$(
  if [ "${GITHUB_REF##*/}" == "master" ]; then
    echo "latest";
  else
    echo ${GITHUB_REF##*/};
  fi | sed -r 's/\//-/g'
);

echo "> Create a Docker image for this specific build. This allows us to go back to a particular build at any time, and makes it possible to deploy without rebuilding by just re-tagging the image.";

docker logout
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin;
docker tag wowanalyzer-server $REPO:$DOCKER_BUILD_TAG;
docker push $REPO:$DOCKER_BUILD_TAG;
docker tag $REPO:$DOCKER_BUILD_TAG $REPO:$DEPLOY_TAG;
docker push $REPO:$DEPLOY_TAG;
