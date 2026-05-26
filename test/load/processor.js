function getIp() {
  return `${Math.floor(Math.random() * 255) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(
    Math.random() * 255
  )}.${Math.floor(Math.random() * 255)}`;
}

function getStrategies(userContext, events, done) {
  userContext.vars.ip = getIp();

  return done();
}

function getValidations(userContext, events, done) {
  userContext.vars.ip = getIp();

  return done();
}

module.exports = {
  getStrategies,
  getValidations
};
