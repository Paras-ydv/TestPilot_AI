import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge
} from "reactflow";
import "reactflow/dist/style.css";

type Props = {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
};

export default function GraphCanvas({
  nodes,
  edges,
  onNodeClick
}: Props) {
  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, n) => onNodeClick(n)}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
