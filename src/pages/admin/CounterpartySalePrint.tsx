import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";

export default function CounterpartySalePrint() {
  const { id } = useParams();
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string>("");
  const printedRef = useRef(false);

  useEffect(() => {
    const saleId = Number(id);
    if (!saleId) {
      setError("Некорректный идентификатор продажи");
      return;
    }

    let isMounted = true;
    api
      .getAdminCounterpartySalePrintHtml(saleId)
      .then((data: { html?: string }) => {
        if (isMounted) {
          setHtml(data.html ?? "");
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message || "Не удалось загрузить печатную форму");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!html || printedRef.current) {
      return;
    }
    printedRef.current = true;
    const timer = window.setTimeout(() => {
      window.print();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [html]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-red-600">
        {error}
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  return <div className="bg-white p-6" dangerouslySetInnerHTML={{ __html: html }} />;
}
