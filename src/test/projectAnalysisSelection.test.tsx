import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import ProjectAnalysisPage from "../pages/ProjectAnalysisPage";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ isRTL: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/docxExtractor", () => ({ extractTextFromDocx: vi.fn() }));
vi.mock("@/lib/pdfIngest", () => ({ ingestPdf: vi.fn(), ingestImage: vi.fn() }));
vi.mock("@/lib/projectDocumentIngest", () => ({ extractProjectDocx: vi.fn(), ingestProjectPdf: vi.fn() }));

afterEach(() => { cleanup(); sessionStorage.clear(); });
const file = (name: string, type = "") => new File([name], name, { type });
const pick = (container: HTMLElement, files: File[]) => {
  const input = container.querySelector("input[type=file]");
  if (!input) throw new Error("File input missing");
  fireEvent.change(input, { target: { files } });
};

describe("Sélection de documents du projet", () => {
  it("conserve 20 documents maximum lors d'une sélection multiple puis d'un ajout", () => {
    const { container } = render(<ProjectAnalysisPage />);
    pick(container, Array.from({ length: 18 }, (_, i) => file(`plan${i}.pdf`, "application/pdf")));
    expect(screen.getAllByRole("listitem")).toHaveLength(18);
    pick(container, [file("ajout1.docx"), file("ajout2.JPG"), file("ajout3.PNG")]);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(screen.queryByText("ajout3.PNG")).toBeNull();
  });
  it("formats conservés, extension Android reconnue et retrait individuel", () => {
    const { container } = render(<ProjectAnalysisPage />);
    pick(container, [file("a.PDF"), file("b.DOCX", "application/octet-stream"), file("c.JPG"), file("d.JPEG"), file("e.PNG"), file("f.xlsx"), file("g.txt")]);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer" })[1]);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByText("b.DOCX")).toBeNull();
    expect(screen.getByText("a.PDF")).toBeInTheDocument();
  });
});