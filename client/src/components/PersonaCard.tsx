import { useState, useEffect } from 'react';
import type { Persona } from '../types';
import './PersonaCard.css';

interface PersonaCardProps {
  persona: Persona;
  initialComplaint: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean; // External control
  onToggle?: () => void; // External toggle handler
}

export function PersonaCard({
  persona,
  initialComplaint,
  collapsible = false,
  defaultExpanded = true,
  isExpanded: externalExpanded,
  onToggle
}: PersonaCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // Use external control if provided, otherwise use internal state
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;

  // Sync internal state with external when it changes
  useEffect(() => {
    if (externalExpanded !== undefined) {
      setInternalExpanded(externalExpanded);
    }
  }, [externalExpanded]);

  const handleToggle = () => {
    if (collapsible) {
      if (onToggle) {
        onToggle();
      } else {
        setInternalExpanded(!internalExpanded);
      }
    }
  };

  return (
    <div className={`persona-card card ${collapsible ? 'collapsible' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div
        className={`persona-header ${collapsible ? 'clickable' : ''}`}
        onClick={handleToggle}
      >
        <div className="persona-avatar">
          {persona.name.charAt(0)}
        </div>
        <div className="persona-info">
          <h2 className="persona-name">{persona.name}</h2>
          <p className="persona-details">
            {persona.age} years old, {persona.gender} | {persona.occupation}
          </p>
        </div>
        {collapsible && (
          <button className="collapse-toggle" type="button" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
            <span className="toggle-icon">{isExpanded ? '−' : '+'}</span>
          </button>
        )}
      </div>

      {/* Always show in expanded mode OR when not collapsible */}
      {(isExpanded || !collapsible) && (
        <>
          <div className="persona-complaint">
            <p>"{initialComplaint}"</p>
          </div>

          <div className="persona-lifestyle">
            <span className="lifestyle-item">
              Activity: {persona.lifestyle.activityLevel}
            </span>
            <span className="lifestyle-item">
              Smoking: {typeof persona.lifestyle.smoking === 'boolean'
                ? (persona.lifestyle.smoking ? 'Yes' : 'No')
                : 'Unknown'}
            </span>
            <span className="lifestyle-item">
              Alcohol: {persona.lifestyle.alcohol}
            </span>
          </div>

          <div className="persona-traits">
            {persona.personalityTraits.map((trait, i) => (
              <span key={i} className="trait-badge">{trait}</span>
            ))}
          </div>
        </>
      )}

      {/* Show brief complaint when collapsed */}
      {collapsible && !isExpanded && (
        <div className="persona-complaint-brief">
          <p>"{initialComplaint.substring(0, 80)}{initialComplaint.length > 80 ? '...' : ''}"</p>
        </div>
      )}
    </div>
  );
}
