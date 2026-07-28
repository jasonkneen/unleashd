export interface CodexCompositeModelParts {
  baseModel: string;
  effort: string | null;
}

export interface CodexCompositeModelVocabulary {
  modelIds: readonly string[];
  effortLevels: readonly string[];
}

/**
 * Named migration adapter for the retired `<model>-<effort>` representation.
 * It only decomposes combinations present in the supplied historical
 * vocabulary; arbitrary current model IDs always pass through unchanged.
 */
export function decodeLegacyCodexCompositeModel(
  modelId: string,
  vocabulary: CodexCompositeModelVocabulary
): CodexCompositeModelParts {
  const modelIds = [...vocabulary.modelIds].sort((a, b) => b.length - a.length);
  for (const baseModel of modelIds) {
    if (modelId === baseModel) return { baseModel, effort: null };
    const prefix = `${baseModel}-`;
    if (!modelId.startsWith(prefix)) continue;

    const effort = modelId.slice(prefix.length);
    if (vocabulary.effortLevels.includes(effort)) return { baseModel, effort };
  }
  return { baseModel: modelId, effort: null };
}

export function encodeLegacyCodexCompositeModel(
  modelId: string,
  effort: string | null | undefined
): string {
  return effort ? `${modelId}-${effort}` : modelId;
}
