import { DocumentationView } from "@/components/ui/documentation-view";
import { DEFAULT_DOC_SLUG } from "@/lib/documentation";

export default function DocumentationIndexPage() {
  return <DocumentationView slug={DEFAULT_DOC_SLUG} />;
}
