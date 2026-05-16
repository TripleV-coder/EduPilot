"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface NodeData {
  name: string;
  value?: number;
  type?: "root" | "school" | "level" | "class" | "student";
  children?: NodeData[];
  metadata?: {
    students?: number;
    teachers?: number;
    averageGrade?: number;
  };
}

interface DendrogramChartProps {
  data: NodeData;
  width?: number;
  height?: number;
  title?: string;
  subtitle?: string;
  onNodeClick?: (node: NodeData) => void;
}

interface LayoutNode {
  x: number;
  y: number;
  data: NodeData;
  parent?: LayoutNode;
}

// Calculate tree layout
function calculateTreeLayout(
  node: NodeData,
  x: number,
  y: number,
  width: number,
  level: number = 0,
  parent?: LayoutNode
): LayoutNode[] {
  const layoutNode: LayoutNode = {
    x,
    y,
    data: node,
    parent,
  };

  const nodes: LayoutNode[] = [layoutNode];

  if (node.children && node.children.length > 0) {
    const childWidth = width / node.children.length;
    const childY = y + 80; // Vertical spacing

    node.children.forEach((child, index) => {
      const childX = x - width / 2 + childWidth * index + childWidth / 2;
      const childNodes = calculateTreeLayout(
        child,
        childX,
        childY,
        childWidth,
        level + 1,
        layoutNode
      );
      nodes.push(...childNodes);
    });
  }

  return nodes;
}

// Get color based on node type
function getNodeColor(type?: string): string {
  switch (type) {
    case "root":
      return "hsl(var(--primary))";
    case "school":
      return "hsl(var(--secondary))";
    case "level":
      return "#3B82F6";
    case "class":
      return "#22C55E";
    case "student":
      return "#F59E0B";
    default:
      return "hsl(var(--muted-foreground))";
  }
}

// Get node size based on type
function getNodeSize(type?: string): number {
  switch (type) {
    case "root":
      return 24;
    case "school":
      return 20;
    case "level":
      return 16;
    case "class":
      return 12;
    case "student":
      return 8;
    default:
      return 12;
  }
}

export function DendrogramChart({
  data,
  width = 800,
  height = 500,
  title,
  subtitle,
  onNodeClick,
}: DendrogramChartProps) {
  const layoutNodes = useMemo(() => {
    return calculateTreeLayout(data, width / 2, 40, width * 0.9);
  }, [data, width]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    layoutNodes.forEach((node) => {
      map.set(node.data.name, node);
    });
    return map;
  }, [layoutNodes]);

  return (
    <Card className="w-full">
      {(title || subtitle) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </CardHeader>
      )}
      <CardContent>
        <div className="relative overflow-hidden rounded-lg bg-muted/20">
          <svg width={width} height={height} className="block">
            {/* Connection lines */}
            {layoutNodes.map((node, index) => {
              if (!node.parent) return null;
              
              return (
                <motion.line
                  key={`line-${index}`}
                  x1={node.parent.x}
                  y1={node.parent.y}
                  x2={node.x}
                  y2={node.y}
                  stroke="hsl(var(--border))"
                  strokeWidth={2}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.02 }}
                />
              );
            })}

            {/* Nodes */}
            {layoutNodes.map((node, index) => {
              const color = getNodeColor(node.data.type);
              const size = getNodeSize(node.data.type);
              const isRoot = node.data.type === "root";

              return (
                <motion.g
                  key={`node-${index}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  className="cursor-pointer"
                  onClick={() => onNodeClick?.(node.data)}
                >
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={size}
                    fill={color}
                    stroke="hsl(var(--background))"
                    strokeWidth={3}
                    className="transition-all duration-200 hover:stroke-primary hover:stroke-4"
                  />

                  {/* Node label */}
                  <text
                    x={node.x}
                    y={node.y + size + 15}
                    textAnchor="middle"
                    fill="hsl(var(--foreground))"
                    fontSize={isRoot ? 14 : 12}
                    fontWeight={isRoot ? 600 : 400}
                    className="pointer-events-none"
                  >
                    {node.data.name}
                  </text>

                  {/* Value indicator for leaf nodes */}
                  {!node.data.children && node.data.value && (
                    <text
                      x={node.x}
                      y={node.y + size + 28}
                      textAnchor="middle"
                      fill="hsl(var(--muted-foreground))"
                      fontSize={10}
                      className="pointer-events-none"
                    >
                      {node.data.value} élèves
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 justify-center">
          {[
            { type: "root", label: "Établissement" },
            { type: "school", label: "Site" },
            { type: "level", label: "Niveau" },
            { type: "class", label: "Classe" },
          ].map((item) => (
            <div key={item.type} className="flex items-center gap-2">
              <div
                className="rounded-full"
                style={{
                  backgroundColor: getNodeColor(item.type),
                  width: getNodeSize(item.type) * 1.2,
                  height: getNodeSize(item.type) * 1.2,
                }}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Example data for EduPilot
export const exampleSchoolStructure: NodeData = {
  name: "CESM",
  type: "root",
  metadata: { students: 1250, teachers: 85 },
  children: [
    {
      name: "Collège",
      type: "school",
      value: 1020,
      metadata: { students: 1020, teachers: 65 },
      children: [
        {
          name: "6ème",
          type: "level",
          value: 280,
          children: [
            { name: "6A", type: "class", value: 35 },
            { name: "6B", type: "class", value: 32 },
            { name: "6C", type: "class", value: 38 },
            { name: "6D", type: "class", value: 30 },
            { name: "6E", type: "class", value: 35 },
            { name: "6F", type: "class", value: 34 },
            { name: "6G", type: "class", value: 36 },
            { name: "6H", type: "class", value: 40 },
          ]
        },
        {
          name: "5ème",
          type: "level",
          value: 265,
          children: [
            { name: "5A", type: "class", value: 33 },
            { name: "5B", type: "class", value: 35 },
            { name: "5C", type: "class", value: 30 },
            { name: "5D", type: "class", value: 38 },
            { name: "5E", type: "class", value: 32 },
            { name: "5F", type: "class", value: 36 },
            { name: "5G", type: "class", value: 34 },
            { name: "5H", type: "class", value: 27 },
          ]
        },
        {
          name: "4ème",
          type: "level",
          value: 245,
          children: [
            { name: "4A", type: "class", value: 31 },
            { name: "4B", type: "class", value: 28 },
            { name: "4C", type: "class", value: 35 },
            { name: "4D", type: "class", value: 30 },
            { name: "4E", type: "class", value: 32 },
            { name: "4F", type: "class", value: 29 },
            { name: "4G", type: "class", value: 33 },
            { name: "4H", type: "class", value: 27 },
          ]
        },
        {
          name: "3ème",
          type: "level",
          value: 230,
          children: [
            { name: "3A", type: "class", value: 30 },
            { name: "3B", type: "class", value: 28 },
            { name: "3C", type: "class", value: 32 },
            { name: "3D", type: "class", value: 27 },
            { name: "3E", type: "class", value: 29 },
            { name: "3F", type: "class", value: 31 },
            { name: "3G", type: "class", value: 26 },
            { name: "3H", type: "class", value: 27 },
          ]
        }
      ]
    },
    {
      name: "Lycée",
      type: "school",
      value: 230,
      metadata: { students: 230, teachers: 20 },
      children: [
        {
          name: "2nde",
          type: "level",
          value: 115,
          children: [
            { name: "2A", type: "class", value: 28 },
            { name: "2B", type: "class", value: 30 },
            { name: "2C", type: "class", value: 29 },
            { name: "2D", type: "class", value: 28 },
          ]
        },
        {
          name: "1ère",
          type: "level",
          value: 75,
          children: [
            { name: "1A", type: "class", value: 25 },
            { name: "1B", type: "class", value: 26 },
            { name: "1C", type: "class", value: 24 },
          ]
        },
        {
          name: "Terminale",
          type: "level",
          value: 50,
          children: [
            { name: "Tle A", type: "class", value: 25 },
            { name: "Tle B", type: "class", value: 25 },
          ]
        }
      ]
    }
  ]
};

export default DendrogramChart;
