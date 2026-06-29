import { diffWords } from "diff";

function ResumeDiff({ oldText, newText }) {
  const differences = diffWords(oldText, newText);

  return (
    <div className="p-4 border rounded bg-white">
      {differences.map((part, index) => (
        <span
          key={index}
          style={{
            backgroundColor: part.added
              ? "#d4edda"
              : part.removed
              ? "#f8d7da"
              : "transparent",
            textDecoration: part.removed ? "line-through" : "none",
          }}
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}

export default ResumeDiff;


<ResumeDiff
  oldText="Built APIs using FastAPI."
  newText="Designed and developed scalable REST APIs using FastAPI, improving backend performance."
/>
import ReactDiffViewer from "react-diff-viewer";

function ResumeComparison({ oldText, newText }) {
  return (
    <ReactDiffViewer
      oldValue={oldText}
      newValue={newText}
      splitView={true}
    />
  );
}

{/* <ResumeComparison
  oldText={originalResume}
  newText={optimizedResume}
/> */}

<ResumeComparison
  oldText={data.original_resume}
  newText={data.optimized_resume}
/>

// when user click optimized resume
const response = await fetch(
  `/optimize-resume/${userId}`,
  {
    method: "POST"
  }
);

const data = await response.json();