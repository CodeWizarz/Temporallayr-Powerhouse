import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    ReactFlow,
    Background,
    Controls,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styled from 'styled-components';

const PageContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: #f9f9f9;
`;

const Header = styled.div`
    padding: 20px;
    background: white;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const TitleBox = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const FlowContainer = styled.div`
    flex: 1;
    position: relative;
`;

const ReplayPanel = styled.div`
    height: 300px;
    background: white;
    border-top: 1px solid #ccc;
    padding: 20px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 13px;
    white-space: pre-wrap;
`;

const Button = styled.button`
    background: #007bff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    &:hover { background: #0056b3; }
    &:disabled { background: #ccc; cursor: not-allowed; }
`;

const NodeLayout = styled.div<{ $status: string }>`
    background: white;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid ${p => p.$status === 'error' ? '#dc3545' : '#ccc'};
    border-left: 4px solid ${p => p.$status === 'error' ? '#dc3545' : '#28a745'};
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    min-width: 200px;
    font-size: 12px;
`;

const NodeTitle = styled.div`font-weight: 600; margin-bottom: 4px;`;
const NodeMetrics = styled.div`color: #666; font-size: 11px; display: flex; gap: 8px;`;

// Custom Node to render span details nicely
const SpanNode = ({ data }: any) => {
    return (
        <NodeLayout $status={data.status}>
            <NodeTitle>{data.name}</NodeTitle>
            <NodeMetrics>
                {data.duration_ms && <span>🕚 {data.duration_ms}ms</span>}
                {data.tokens && <span>🪙 {data.tokens} tkns</span>}
                {data.cost && <span>💰 ${data.cost}</span>}
            </NodeMetrics>
            {data.status === 'error' && <div style={{ color: '#dc3545', marginTop: 4 }}>{data.error_msg}</div>}
        </NodeLayout>
    );
};

const nodeTypes = { span: SpanNode };

// Layout algorithm: very simple depth-based cascading
function buildGraphLayout(spans: any[]) {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Build tree
    const rootSpans = spans.filter(s => !s.parent_span_id);
    const childrenByParent: Record<string, any[]> = {};
    spans.forEach(s => {
        if (s.parent_span_id) {
            if (!childrenByParent[s.parent_span_id]) childrenByParent[s.parent_span_id] = [];
            childrenByParent[s.parent_span_id].push(s);
        }
    });

    let currentY = 50;

    const traverse = (span: any, depth: number) => {
        const attrs = span.attributes || {};
        const duration = attrs.duration_ms;
        const tokens = attrs['llm.token_count.total'];
        const cost = attrs.cost_usd;

        nodes.push({
            id: span.span_id,
            type: 'span',
            position: { x: depth * 250 + 50, y: currentY },
            data: {
                name: span.name,
                status: span.status,
                duration_ms: duration,
                tokens,
                cost,
                error_msg: attrs.error
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        });

        currentY += 100; // Step down for the next node (even siblings)

        const children = childrenByParent[span.span_id] || [];
        children.forEach((child: any) => {
            edges.push({
                id: `e-${span.span_id}-${child.span_id}`,
                source: span.span_id,
                target: child.span_id,
                animated: true,
                style: { stroke: '#999' }
            });
            traverse(child, depth + 1);
        });
    };

    rootSpans.forEach(rs => traverse(rs, 0));
    return { initialNodes: nodes, initialEdges: edges };
}

export default function TraceDetailPage() {
    const { traceId } = useParams();
    const [graphData, setGraphData] = useState<any>(null);
    const [replayReport, setReplayReport] = useState<any>(null);
    const [replaying, setReplaying] = useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                // Hardcoded dev tenant/key for demo purposes since we just want it to work
                const res = await fetch(`http://localhost:8000/executions/${traceId}`, {
                    headers: { 'Authorization': 'Bearer dev-key' }
                });
                if (res.ok) {
                    const data = await res.json();
                    setGraphData(data);
                    const { initialNodes, initialEdges } = buildGraphLayout(data.spans || []);
                    setNodes(initialNodes);
                    setEdges(initialEdges);
                }
            } catch (err) {
                console.error("Failed to fetch trace", err);
            }
        };
        if (traceId) fetchGraph();
    }, [traceId]);

    const handleReplay = async () => {
        if (!traceId) return;
        setReplaying(true);
        setReplayReport(null);
        try {
            const res = await fetch(`http://localhost:8000/executions/${traceId}/replay`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer dev-key' }
            });
            const data = await res.json();
            setReplayReport(data);
        } catch (err) {
            console.error("Replay failed", err);
            setReplayReport({ error: String(err) });
        } finally {
            setReplaying(false);
        }
    };

    if (!graphData) return <PageContainer><div style={{ padding: 20 }}>Loading Trace {traceId}...</div></PageContainer>;

    return (
        <PageContainer>
            <Header>
                <TitleBox>
                    <h2>Trace DAG: {traceId}</h2>
                    <div style={{ color: '#666' }}>Tenant: {graphData.tenant_id} | Spans: {graphData.spans?.length || 0}</div>
                </TitleBox>
                <Button onClick={handleReplay} disabled={replaying}>
                    {replaying ? "Replaying..." : "▶ Replay Execution"}
                </Button>
            </Header>

            <FlowContainer>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="bottom-right"
                >
                    <Background color="#ccc" gap={16} />
                    <Controls />
                </ReactFlow>
            </FlowContainer>

            {replayReport && (
                <ReplayPanel>
                    <h3 style={{ marginTop: 0, color: replayReport.is_deterministic ? '#28a745' : '#dc3545' }}>
                        {replayReport.is_deterministic ? "✅ Deterministic - No Divergences" : `❌ Divergence Detected (${replayReport.divergences_found})`}
                    </h3>
                    <pre>{JSON.stringify(replayReport, null, 2)}</pre>
                </ReplayPanel>
            )}
        </PageContainer>
    );
}
