export class CypressConfigurationError extends Error {}

export class MissingConfigurationFileError extends CypressConfigurationError {}

export class MultipleConfigurationFilesError extends CypressConfigurationError {}

export class UnrecognizedConfigurationFileError extends CypressConfigurationError {}
