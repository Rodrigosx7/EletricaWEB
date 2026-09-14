import QdcEditor from '../features/qdc/editor/QdcEditor';

export default function MontagemQuadros({ usuarioId, aoAlterar }: { usuarioId: string; aoAlterar: (alterado: boolean) => void }) {
  return <QdcEditor usuarioId={usuarioId} aoAlterar={aoAlterar} />;
}
