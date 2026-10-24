import {
  AlgebraicType,
  ProductType,
  SumType,
  type Serializer,
  type Deserializer,
} from 'spacetimedb';

// SDK 2.13 generates Product/Sum serializers with Function(). These interpreted
// plans preserve BSATN wire encoding while allowing a CSP without unsafe-eval.
const productDecode = ProductType.makeDeserializer;
const sumEncode = SumType.makeSerializer;
const sumDecode = SumType.makeDeserializer;
const special = new Set([
  '__identity__',
  '__connection_id__',
  '__timestamp_micros_since_unix_epoch__',
  '__time_duration_micros__',
  '__uuid__',
]);
const encoders = new WeakMap<object, Serializer<any>>();
const decoders = new WeakMap<object, Deserializer<any>>();
ProductType.makeSerializer = (type, space) => {
  const old = encoders.get(type);
  if (old) return old;
  const fields: Array<{ name: string; encode: Serializer<any> }> = [];
  const encode: Serializer<any> = (writer, value) => {
    for (const field of fields) field.encode(writer, value[field.name]);
  };
  encoders.set(type, encode);
  for (const field of type.elements)
    fields.push({
      name: field.name!,
      encode: AlgebraicType.makeSerializer(field.algebraicType, space),
    });
  return encode;
};
ProductType.makeDeserializer = (type, space) => {
  if (!type.elements.length || (type.elements.length === 1 && special.has(type.elements[0].name!)))
    return productDecode(type, space);
  const old = decoders.get(type);
  if (old) return old;
  const fields: Array<{ name: string; decode: Deserializer<any> }> = [];
  const decode: Deserializer<any> = (reader) => {
    const value: Record<string, unknown> = {};
    for (const field of fields)
      Object.defineProperty(value, field.name, {
        value: field.decode(reader),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return value;
  };
  decoders.set(type, decode);
  for (const field of type.elements)
    fields.push({
      name: field.name!,
      decode: AlgebraicType.makeDeserializer(field.algebraicType, space),
    });
  return decode;
};
function simpleSum(type: Parameters<typeof SumType.makeSerializer>[0]) {
  return (
    type.variants.length === 2 &&
    ((type.variants[0].name === 'some' && type.variants[1].name === 'none') ||
      (type.variants[0].name === 'ok' && type.variants[1].name === 'err'))
  );
}
SumType.makeSerializer = (type, space) => {
  if (simpleSum(type)) return sumEncode(type, space);
  const old = encoders.get(type);
  if (old) return old;
  const variants: Array<{ name: string; encode: Serializer<any> }> = [];
  const encode: Serializer<any> = (writer, value) => {
    const index = variants.findIndex((v) => v.name === value.tag);
    if (index < 0) throw Error('Unknown BSATN variant.');
    writer.writeU8(index);
    variants[index].encode(writer, value.value);
  };
  encoders.set(type, encode);
  for (const variant of type.variants)
    variants.push({
      name: variant.name!,
      encode: AlgebraicType.makeSerializer(variant.algebraicType, space),
    });
  return encode;
};
SumType.makeDeserializer = (type, space) => {
  if (simpleSum(type)) return sumDecode(type, space);
  const old = decoders.get(type);
  if (old) return old;
  const variants: Array<{ name: string; decode: Deserializer<any> }> = [];
  const decode: Deserializer<any> = (reader) => {
    const variant = variants[reader.readU8()];
    if (!variant) throw Error('Unknown BSATN variant.');
    return { tag: variant.name, value: variant.decode(reader) };
  };
  decoders.set(type, decode);
  for (const variant of type.variants)
    variants.push({
      name: variant.name!,
      decode: AlgebraicType.makeDeserializer(variant.algebraicType, space),
    });
  return decode;
};
