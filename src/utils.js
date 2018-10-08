const getUTCTimeString = () => Math.round(new Date().getTime() / 1000).toString();

module.exports = {
  getUTCTimeString
};
