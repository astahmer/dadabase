export const TableName = (props: {
  schema: string;
  table: string;
  hasMultipleSchemas: boolean;
}) => {
  const { schema, table, hasMultipleSchemas } = props;

  if (hasMultipleSchemas) {
    return `${schema}.${table}`;
  }

  return table;
};
