"""AccessAI log analytics with Apache Spark (HANDOFF.md §52).

The admin dashboard asks MongoDB for live numbers. This job is the
"big data" path for when the logs grow far beyond that: Spark reads the
exported logs and computes the same kinds of results in parallel, on as
many CPU cores (or, on a real cluster, machines) as it is given.

    cd backend && npm run export-logs          # MongoDB → analytics/data/*.jsonl
    cd analytics
    .venv\\Scripts\\python spark_job.py           # the real logs
    .venv\\Scripts\\python spark_job.py --scale 100     # the same logs ×100
    .venv\\Scripts\\python spark_job.py --scale 10000   # ×10,000

`--scale N` copies every record N times (each copy as different people,
spread over the same days) to show the same job on N times the data.
Results: printed, and saved to analytics/out/results.json. Nothing here
writes to the database or holds names, emails, addresses or locations —
the export already turned people into hashes.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUT = HERE / "out"

# Spark's Python workers must use this same Python (Windows).
os.environ.setdefault("PYSPARK_PYTHON", sys.executable)
os.environ.setdefault("PYSPARK_DRIVER_PYTHON", sys.executable)

from pyspark.sql import SparkSession, Window  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402

STREAK = 5  # the same rule as the admin panel's "consecutive failed logins"


def spark_session():
    return (
        SparkSession.builder.appName("AccessAI log analytics")
        .master("local[*]")  # every CPU core of this computer; a cluster URL on a real cluster
        .config("spark.sql.session.timeZone", "Asia/Manila")
        .config("spark.driver.host", "127.0.0.1")
        .config("spark.ui.showConsoleProgress", "false")
        .config("spark.sql.shuffle.partitions", "8")
        .getOrCreate()
    )


def scaled(df, scale, spark, people_cols):
    """Each record `scale` times; each copy as different people, a few hours apart."""
    if scale <= 1:
        return df
    copies = spark.range(scale).withColumnRenamed("id", "copy")
    out = df.crossJoin(copies)
    for col in people_cols:
        out = out.withColumn(col, F.when(F.col(col).isNull(), None).otherwise(F.concat_ws("-", F.col(col), F.col("copy"))))
    # Spread copies over ±12 hours so they don't all land on the same minute —
    # and move an SOS's answers with it, so answer times stay the same.
    out = out.withColumn("_shift", F.expr("make_interval(0, 0, 0, 0, 0, cast((copy % 1440) - 720 as int), 0)"))
    out = out.withColumn("at", F.col("at") + F.col("_shift"))
    if "answers" in df.columns:
        out = out.withColumn(
            "answers",
            F.transform("answers", lambda a: F.struct((F.to_timestamp(a["at"]) + F.col("_shift")).alias("at"), a["kind"].alias("kind"))),
        )
    return out.drop("copy", "_shift")


def rows(df, limit=50):
    return [r.asDict(recursive=True) for r in df.limit(limit).collect()]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scale", type=int, default=1, help="copy every record this many times")
    args = parser.parse_args()
    if not (DATA / "activity.jsonl").exists():
        sys.exit("No data yet: run `npm run export-logs` in backend/ first.")

    spark = spark_session()
    spark.sparkContext.setLogLevel("ERROR")
    started = time.perf_counter()

    read = lambda name: spark.read.json(str(DATA / f"{name}.jsonl")).withColumn("at", F.to_timestamp("at"))  # noqa: E731
    activity = scaled(read("activity"), args.scale, spark, ["user", "address"]).cache()
    sos = scaled(read("sos"), args.scale, spark, []).cache()
    admin = scaled(read("admin_log"), args.scale, spark, ["admin"]).cache()

    total = activity.count() + sos.count() + admin.count()

    # 1. Logins per day (Manila), by result.
    logins = (
        activity.where(F.col("type").startswith("login."))
        .groupBy(F.to_date("at").alias("day"))
        .pivot("type", ["login.success", "login.failed", "login.refused"])
        .count()
        .fillna(0)
        .orderBy("day")
    )

    # 2. Consecutive failed logins — window functions: within each account,
    #    in time order, every successful login starts a new run; the longest
    #    run of failures per account is its streak.
    by_user = Window.partitionBy("user").orderBy("at")
    runs = (
        activity.where(F.col("user").isNotNull() & F.col("type").isin("login.failed", "login.success"))
        .withColumn("run", F.sum(F.when(F.col("type") == "login.success", 1).otherwise(0)).over(by_user))
        .where(F.col("type") == "login.failed")
        .groupBy("user", "run")
        .agg(F.count("*").alias("in_a_row"), F.min("at").alias("from"), F.max("at").alias("to"))
    )
    streaks = (
        runs.groupBy("user")
        .agg(F.max("in_a_row").alias("longest_streak"))
        .where(F.col("longest_streak") >= STREAK)
        .orderBy(F.desc("longest_streak"))
    )

    # 3. Busiest hours: activity by weekday × hour (Manila).
    busiest = (
        activity.groupBy(F.date_format("at", "E").alias("weekday"), F.hour("at").alias("hour"))
        .count()
        .orderBy(F.desc("count"))
    )

    # 4. How fast friends answer a real SOS (first answer, minutes).
    answers = (
        sos.where(~F.col("isTest") & (F.size("answers") > 0))
        .withColumn("first", F.array_min(F.transform("answers", lambda a: F.to_timestamp(a["at"]))))
        .withColumn("minutes", (F.unix_timestamp("first") - F.unix_timestamp("at")) / 60)
        .where(F.col("minutes") >= 0)
        .agg(
            F.count("*").alias("answered_sos"),
            F.percentile_approx("minutes", 0.5).alias("median_minutes"),
            F.percentile_approx("minutes", 0.9).alias("p90_minutes"),
        )
    )
    unanswered = sos.where(~F.col("isTest") & (F.size("answers") == 0)).count()

    # 5. Usage limits hit, by limit; 6. admin actions, by action.
    limits = activity.where(F.col("type") == "limit.hit").groupBy("limiter").count().orderBy(F.desc("count"))
    admin_actions = admin.groupBy("action").count().orderBy(F.desc("count"))

    results = {
        "scale": args.scale,
        "records": total,
        "logins_per_day": rows(logins, 120),
        "consecutive_failed_logins": {"rule": f"{STREAK}+ in a row", "accounts": streaks.count(), "top": rows(streaks, 10)},
        "busiest_hours": rows(busiest, 10),
        "sos_first_answer": rows(answers)[0] if answers.count() else {},
        "sos_unanswered_real": unanswered,
        "limits_hit": rows(limits),
        "admin_actions": rows(admin_actions),
    }
    seconds = time.perf_counter() - started
    results["seconds"] = round(seconds, 2)
    results["cores"] = spark.sparkContext.defaultParallelism

    print(f"\nAccessAI log analytics — {total:,} records (scale ×{args.scale}) in {seconds:.1f} s on {results['cores']} cores\n")
    print("Logins per day:")
    logins.show(10, truncate=False)
    print(f"Accounts with {STREAK}+ failed logins in a row: {results['consecutive_failed_logins']['accounts']:,}")
    streaks.show(5, truncate=False)
    print("Busiest hours (Manila):")
    busiest.show(5, truncate=False)
    print("First answer to a real SOS (minutes):", results["sos_first_answer"], "| unanswered real SOS:", unanswered)
    print("Limits hit:")
    limits.show(5, truncate=False)

    OUT.mkdir(exist_ok=True)
    (OUT / "results.json").write_text(json.dumps(results, indent=1, default=str), encoding="utf-8")
    print(f"Saved {OUT / 'results.json'}")
    spark.stop()


if __name__ == "__main__":
    main()
