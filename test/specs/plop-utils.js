module.exports = {
    plopMock: (plopDef, generator) => {
        const generators = {};
        const helpers = {};
        result = new Object({
            generators,
            setGenerator: (name, generator) =>
                generators[name] = generator,
            helpers,
            setHelper: (name, helper) =>
                helpers[name] = helper,
            prompt: function(name, defaults) {
                plopDef(this, { defaults });
                return this.generators[generator].prompts
                    .filter(prompt => prompt.name == name)[0];
            }
        })
        return result;
    }
}
