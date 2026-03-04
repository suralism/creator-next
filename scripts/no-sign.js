// Skip code signing - no certificate needed for personal/internal use
exports.default = async function (configuration) {
    // intentionally empty - skip signing
    return;
};
