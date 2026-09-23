import QdcEditor from '../features/qdc/editor/QdcEditor';

export default function MontagemQuadros({ usuarioId, aoAlterar, aoSair }: { usuarioId: string; aoAlterar: (alterado: boolean) => void; aoSair: () => void }) {
  return <QdcEditor usuarioId={usuarioId} aoAlterar={aoAlterar} aoSair={aoSair} />;
}
