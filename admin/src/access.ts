export default function access(initialState: { admin?: { canAdmin: boolean } }) {
  const { admin } = initialState || {};
  return {
    canAdmin: admin?.canAdmin || false,
  };
}