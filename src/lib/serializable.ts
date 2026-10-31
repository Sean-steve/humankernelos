export type SerializableJson =
  | string
  | number
  | boolean
  | null
  | SerializableJson[]
  | { [key: string]: SerializableJson };

export function toSerializableJson(value: unknown): SerializableJson {
  if (value === undefined) return null;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) return null;
  return JSON.parse(encoded) as SerializableJson;
}
